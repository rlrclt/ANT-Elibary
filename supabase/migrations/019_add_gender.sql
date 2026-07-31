-- ==========================================================
-- 019_add_gender.sql
-- ==========================================================

-- 1. Add gender column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'not_specified';

-- 2. Recreate handle_new_auth_user to include gender
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
      address,
      gender
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
      NEW.raw_user_meta_data ->> 'address',
      COALESCE(NEW.raw_user_meta_data ->> 'gender', 'not_specified')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'user_id_code_already_exists';
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
