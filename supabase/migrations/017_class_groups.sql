-- ==========================================================
-- 017_class_groups.sql — Class Group Codes (รหัสกลุ่มเรียน)
-- ==========================================================

-- 1. Create table dropdown_class_groups
CREATE TABLE IF NOT EXISTS public.dropdown_class_groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,
  name           VARCHAR(100),
  department_id  UUID NOT NULL REFERENCES public.dropdown_departments(id) ON DELETE CASCADE,
  class_level_id UUID NOT NULL REFERENCES public.dropdown_class_levels(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  visible_to     TEXT[] NOT NULL DEFAULT ARRAY['student'],
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Add columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS class_group_id UUID REFERENCES public.dropdown_class_groups(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS class_group VARCHAR(50);

-- 3. Enable RLS
ALTER TABLE public.dropdown_class_groups ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for dropdown_class_groups
DROP POLICY IF EXISTS "select_class_groups_public" ON public.dropdown_class_groups;
CREATE POLICY "select_class_groups_public" ON public.dropdown_class_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "modify_class_groups_admin" ON public.dropdown_class_groups;
CREATE POLICY "modify_class_groups_admin" ON public.dropdown_class_groups FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Recreate handle_new_auth_user to include class_group_id
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  v_user_id_code VARCHAR(50);
BEGIN
  v_user_id_code := NEW.raw_user_meta_data ->> 'user_id_code';
  IF v_user_id_code IS NULL THEN
    v_user_id_code := 'AUTO-' || UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8));
  END IF;

  BEGIN
    INSERT INTO public.users (
      id,
      user_id_code,
      full_name,
      email,
      phone,
      role,
      user_type,
      department_id,
      class_level_id,
      room_level_id,
      class_group_id,
      address
    )
    VALUES (
      NEW.id,
      v_user_id_code,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'ไม่ระบุชื่อ'),
      NEW.email,
      NEW.raw_user_meta_data ->> 'phone',
      'member',
      COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'student'),
      NULLIF(NEW.raw_user_meta_data ->> 'department_id', '')::UUID,
      NULLIF(NEW.raw_user_meta_data ->> 'class_level_id', '')::UUID,
      NULLIF(NEW.raw_user_meta_data ->> 'room_level_id', '')::UUID,
      NULLIF(NEW.raw_user_meta_data ->> 'class_group_id', '')::UUID,
      NEW.raw_user_meta_data ->> 'address'
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'user_id_code_already_exists';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update sync_user_dropdown_text_fields trigger function
CREATE OR REPLACE FUNCTION public.sync_user_dropdown_text_fields()
RETURNS trigger AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    SELECT name INTO NEW.department FROM public.dropdown_departments WHERE id = NEW.department_id;
  ELSE
    NEW.department := NULL;
  END IF;

  IF NEW.class_level_id IS NOT NULL THEN
    SELECT name INTO NEW.class_level FROM public.dropdown_class_levels WHERE id = NEW.class_level_id;
  ELSE
    NEW.class_level := NULL;
  END IF;

  IF NEW.room_level_id IS NOT NULL THEN
    SELECT name INTO NEW.room_level FROM public.dropdown_room_levels WHERE id = NEW.room_level_id;
  ELSE
    NEW.room_level := NULL;
  END IF;

  IF NEW.class_group_id IS NOT NULL THEN
    SELECT code INTO NEW.class_group FROM public.dropdown_class_groups WHERE id = NEW.class_group_id;
  ELSE
    NEW.class_group := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Class group rename sync trigger
CREATE OR REPLACE FUNCTION public.sync_users_on_class_group_rename()
RETURNS trigger AS $$
BEGIN
  IF OLD.code IS DISTINCT FROM NEW.code THEN
    UPDATE public.users SET class_group = NEW.code WHERE class_group_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_on_class_group_rename ON public.dropdown_class_groups;
CREATE TRIGGER trigger_sync_users_on_class_group_rename
AFTER UPDATE OF code ON public.dropdown_class_groups
FOR EACH ROW EXECUTE FUNCTION public.sync_users_on_class_group_rename();
