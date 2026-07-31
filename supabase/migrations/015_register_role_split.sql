-- ==========================================================
-- 015_register_role_split.sql — User Role Split & Dropdown Tables
-- ==========================================================

-- Adding new columns to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'student' CHECK (user_type IN ('student', 'teacher', 'staff', 'external'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS room_level VARCHAR(50);

-- Creating dropdown tables
CREATE TABLE IF NOT EXISTS public.dropdown_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dropdown_class_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dropdown_room_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Update trigger function to store new metadata fields
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  v_user_id_code VARCHAR(50);
BEGIN
  v_user_id_code := NEW.raw_user_meta_data ->> 'user_id_code';
  IF v_user_id_code IS NULL THEN
    v_user_id_code := 'AUTO-' || UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8));
  END IF;

  INSERT INTO public.users (
    id,
    user_id_code,
    full_name,
    email,
    phone,
    role,
    user_type,
    department,
    class_level,
    room_level,
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
    NEW.raw_user_meta_data ->> 'department',
    NEW.raw_user_meta_data ->> 'class_level',
    NEW.raw_user_meta_data ->> 'room_level',
    NEW.raw_user_meta_data ->> 'address'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
