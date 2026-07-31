# Multi-role Registration and Admin Dropdown CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify registration page to support 4 member categories, dynamic forms, validation, and add an admin page to manage dropdown options in the database.

**Architecture:**
- Database: 3 new dropdown tables (`dropdown_departments`, `dropdown_class_levels`, `dropdown_room_levels`) and columns added to `users`. RLS enabled.
- API / Server: Modify Supabase triggers to handle dynamic `user_type` and other profiles from metadata.
- Frontend: Dropdown options fetched from DB, conditional UI validation in registration, address search using `react-thailand-address-typeahead`.
- Admin CRUD page: Tabbed view for options management.

**Tech Stack:** Next.js, Supabase, Tailwind CSS/Vanilla CSS, react-thailand-address-typeahead

## Global Constraints
- Target database schemas must be migrated.
- Form validation must match user role (student, teacher, staff, external).
- Admin pages must be accessible ONLY to users with `role = 'admin'`.

---

### Task 1: Supabase Database Migration

**Files:**
- Create: `supabase/migrations/015_register_role_split.sql`

- [ ] **Step 1: Write Migration Script**
  Create the migration SQL script containing:
  - Adding `user_type` and `room_level` columns to `public.users` table.
  - Creating `public.dropdown_departments`, `public.dropdown_class_levels`, `public.dropdown_room_levels` tables.
  - Applying RLS policies for public SELECT and admin-only modification on those tables.
  - Updating `public.handle_new_auth_user()` trigger function to store `user_type`, `room_level`, and `address` to the database profile from raw user metadata.

  *Expected Code:*
  ```sql
  -- Adding new columns to users
  ALTER TABLE public.users ADD COLUMN user_type VARCHAR(20) DEFAULT 'student' CHECK (user_type IN ('student', 'teacher', 'staff', 'external'));
  ALTER TABLE public.users ADD COLUMN room_level VARCHAR(50);

  -- Creating tables
  CREATE TABLE public.dropdown_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE public.dropdown_class_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE public.dropdown_room_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Enable RLS
  ALTER TABLE public.dropdown_departments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.dropdown_class_levels ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.dropdown_room_levels ENABLE ROW LEVEL SECURITY;

  -- Create Policies
  CREATE POLICY "select_departments_public" ON public.dropdown_departments FOR SELECT USING (true);
  CREATE POLICY "modify_departments_admin" ON public.dropdown_departments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

  CREATE POLICY "select_class_levels_public" ON public.dropdown_class_levels FOR SELECT USING (true);
  CREATE POLICY "modify_class_levels_admin" ON public.dropdown_class_levels FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

  CREATE POLICY "select_room_levels_public" ON public.dropdown_room_levels FOR SELECT USING (true);
  CREATE POLICY "modify_room_levels_admin" ON public.dropdown_room_levels FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

  -- Update trigger function
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
  ```

- [ ] **Step 2: Run SQL Migration**
  Examine database status and apply the SQL script. (Can apply via local Supabase CLI or using a direct database run).

---

### Task 2: Package Installation & TS Typings

**Files:**
- Modify: `package.json`
- Create: `app/types/react-thailand-address-typeahead.d.ts`

- [ ] **Step 1: Install Address Typeahead Library**
  Run command: `npm install react-thailand-address-typeahead`

- [ ] **Step 2: Create TypeScript Declaration File**
  Create `app/types/react-thailand-address-typeahead.d.ts` with custom module declarations:
  ```typescript
  declare module 'react-thailand-address-typeahead' {
    import * as React from 'react';

    export interface AddressTypeaheadProps {
      onSelect?: (address: any) => void;
      // Define other props as needed
    }

    export const AddressTypeahead: React.FC<AddressTypeaheadProps>;
    // Or other exports based on library usage
  }
  ```

---

### Task 3: Update Registration Logic and UI

**Files:**
- Modify: `app/hooks/use-register-client.ts`
- Modify: `app/register/page.tsx`

- [ ] **Step 1: Update useRegisterClient**
  Extract and validate registration parameters conditionally based on selected `user_type`:
  - `student`: validate `user_id_code` (>= 12 chars), require `department`, `class_level`, `room_level`.
  - `teacher` & `staff`: require `department`, validate `user_id_code` exists.
  - `external`: validate `user_id_code` (13 digits numeric), require `address`.
  Pass these variables to `supabase.auth.signUp` inside options metadata payload.

- [ ] **Step 2: Update register/page.tsx UI**
  - Fetch dropdown options from Supabase on mount.
  - Render a dropdown/select to choose the user type.
  - Dynamically render inputs based on user type.
  - Display validation error if any fields fail constraints.

---

### Task 4: Layout & Sidebar Updates

**Files:**
- Modify: `app/staff/layout.tsx`
- Modify: `app/components/staff-sidebar.tsx`

- [ ] **Step 1: Pass Role in Layout**
  Verify and update `StaffLayout` to pass `role={profile.role}` to the `StaffSidebar` component.

- [ ] **Step 2: Add Option in Sidebar**
  Inside `StaffSidebar`, check if `role === 'admin'`. If yes, add a navigation option for "จัดการข้อมูลตัวเลือก" leading to `/staff/settings/dropdowns`.

---

### Task 5: Admin Settings Dropdowns (CRUD) Page

**Files:**
- Create: `app/staff/settings/dropdowns/page.tsx`
- Create: `app/staff/settings/dropdowns/actions.ts`

- [ ] **Step 1: Create Server Actions for Option CRUD**
  Define server actions to read, add, and delete options from the three database tables: `dropdown_departments`, `dropdown_class_levels`, `dropdown_room_levels`.

- [ ] **Step 2: Build the Admin CRUD Interface**
  Develop tabbed user interface components for Admin to add, list, and delete options from each of the three tables.

---

### Task 6: Verification

- [ ] **Step 1: Verify Registration E2E**
  Perform test registrations for each of the 4 user types and ensure data is populated in database correctly.
- [ ] **Step 2: Verify Admin Access Control**
  Verify regular staff and members cannot access `/staff/settings/dropdowns` and are redirected, while admins can access and manage values.

---

### Task 7: Option Roles Visibility & Admin Filtering

**Files:**
- Modify: `supabase/migrations/015_register_role_split.sql`
- Modify: `app/staff/settings/dropdowns/actions.ts`
- Modify: `app/staff/settings/dropdowns/components/dropdown-client.tsx`
- Modify: `app/register/page.tsx`

- [ ] **Step 1: Update Database Schema**
  Alter migration file to add `allowed_roles VARCHAR(20)[]` to the three dropdown tables.
- [ ] **Step 2: Update Server Actions**
  Update server actions to accept and persist `allowed_roles`.
- [ ] **Step 3: Update Admin UI Form & Filter**
  Add allowed roles checkboxes in the Add/Edit form, and add a role filter filter to only list options matching a selected role in the table.
- [ ] **Step 4: Update Registration Filtering**
  Filter options on the registration page client-side based on `allowed_roles` containing the user's selected `user_type`.

