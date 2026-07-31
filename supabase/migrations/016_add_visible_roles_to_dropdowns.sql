-- Add visible_to column to dropdown tables

ALTER TABLE dropdown_departments
ADD COLUMN visible_to text[] NOT NULL DEFAULT '{}';

ALTER TABLE dropdown_class_levels
ADD COLUMN visible_to text[] NOT NULL DEFAULT '{}';

ALTER TABLE dropdown_room_levels
ADD COLUMN visible_to text[] NOT NULL DEFAULT '{}';
