-- ==========================================================
-- 015_register_role_split.sql — User Role Split & Dropdown Tables (v2)
-- ==========================================================

-- Adding new columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'student' CHECK (user_type IN ('student', 'teacher', 'staff', 'external'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS room_level VARCHAR(50);

-- Creating dropdown tables
CREATE TABLE IF NOT EXISTS public.dropdown_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_to TEXT[] NOT NULL DEFAULT ARRAY['student','teacher','staff','external'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP INDEX IF EXISTS public.dropdown_departments_name_ci_uq;
CREATE UNIQUE INDEX IF NOT EXISTS dropdown_departments_name_ci_uq ON public.dropdown_departments (lower(name));

CREATE TABLE IF NOT EXISTS public.dropdown_class_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP INDEX IF EXISTS public.dropdown_class_levels_name_ci_uq;
CREATE UNIQUE INDEX IF NOT EXISTS dropdown_class_levels_name_ci_uq ON public.dropdown_class_levels (lower(name));

CREATE TABLE IF NOT EXISTS public.dropdown_room_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP INDEX IF EXISTS public.dropdown_room_levels_name_ci_uq;
CREATE UNIQUE INDEX IF NOT EXISTS dropdown_room_levels_name_ci_uq ON public.dropdown_room_levels (lower(name));

-- Add columns to users as UUID foreign keys
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.dropdown_departments(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS class_level_id UUID REFERENCES public.dropdown_class_levels(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS room_level_id UUID REFERENCES public.dropdown_room_levels(id);

-- Enable RLS
ALTER TABLE public.dropdown_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_class_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropdown_room_levels ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS "select_departments_public" ON public.dropdown_departments;
CREATE POLICY "select_departments_public" ON public.dropdown_departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "modify_departments_admin" ON public.dropdown_departments;
CREATE POLICY "modify_departments_admin" ON public.dropdown_departments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "select_class_levels_public" ON public.dropdown_class_levels;
CREATE POLICY "select_class_levels_public" ON public.dropdown_class_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "modify_class_levels_admin" ON public.dropdown_class_levels;
CREATE POLICY "modify_class_levels_admin" ON public.dropdown_class_levels FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "select_room_levels_public" ON public.dropdown_room_levels;
CREATE POLICY "select_room_levels_public" ON public.dropdown_room_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "modify_room_levels_admin" ON public.dropdown_room_levels;
CREATE POLICY "modify_room_levels_admin" ON public.dropdown_room_levels FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Update trigger function to store new metadata fields with transactional error handling
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
      NEW.raw_user_meta_data ->> 'address'
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'user_id_code_already_exists';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for syncing user text fields department, class_level, room_level with UUID names
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_user_dropdown_text_fields ON public.users;
CREATE TRIGGER trigger_sync_user_dropdown_text_fields
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_dropdown_text_fields();

-- Dropdown table rename triggers

CREATE OR REPLACE FUNCTION public.sync_users_on_department_rename()
RETURNS trigger AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.users SET department = NEW.name WHERE department_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_on_department_rename ON public.dropdown_departments;
CREATE TRIGGER trigger_sync_users_on_department_rename
AFTER UPDATE OF name ON public.dropdown_departments
FOR EACH ROW EXECUTE FUNCTION public.sync_users_on_department_rename();

CREATE OR REPLACE FUNCTION public.sync_users_on_class_level_rename()
RETURNS trigger AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.users SET class_level = NEW.name WHERE class_level_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_on_class_level_rename ON public.dropdown_class_levels;
CREATE TRIGGER trigger_sync_users_on_class_level_rename
AFTER UPDATE OF name ON public.dropdown_class_levels
FOR EACH ROW EXECUTE FUNCTION public.sync_users_on_class_level_rename();

CREATE OR REPLACE FUNCTION public.sync_users_on_room_level_rename()
RETURNS trigger AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.users SET room_level = NEW.name WHERE room_level_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_on_room_level_rename ON public.dropdown_room_levels;
CREATE TRIGGER trigger_sync_users_on_room_level_rename
AFTER UPDATE OF name ON public.dropdown_room_levels
FOR EACH ROW EXECUTE FUNCTION public.sync_users_on_room_level_rename();

