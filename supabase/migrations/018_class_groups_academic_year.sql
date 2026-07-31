-- ==========================================================
-- 018_class_groups_academic_year.sql
-- ==========================================================

-- 1. Add academic_year column to dropdown_class_groups
ALTER TABLE public.dropdown_class_groups 
ADD COLUMN IF NOT EXISTS academic_year VARCHAR(10) NOT NULL DEFAULT '2569';

-- Ensure code remains strictly unique
-- (If there was no unique constraint for some reason, we make sure it exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dropdown_class_groups_code_key'
  ) THEN
    ALTER TABLE public.dropdown_class_groups ADD CONSTRAINT dropdown_class_groups_code_key UNIQUE (code);
  END IF;
END $$;
