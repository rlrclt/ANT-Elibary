# Design Spec: Multi-role Registration and Admin Dropdown CRUD (v2)

**Date**: 2026-08-01
**Status**: Revised Proposal — supersedes v1
**Change summary**: Added referential integrity between `users` and dropdown tables, added missing dropdown columns (`is_active`, `sort_order`, `updated_at`), added Update operation to admin CRUD, clarified delete-safety mechanism, and closed a duplicate-code failure mode in the signup trigger. See "Open Questions for Team" at the end for naming/UX items that need a decision but don't block schema work.

---

## 1. Objectives

- Enhance user profiles and registration to support 4 member categories: `student`, `teacher`, `staff`, and `external`.
- Maintain standard database compatibility by saving user `role` as `'member'` for all these types, while differentiating via a new `user_type` column.
- Implement conditional validation and fields based on the selected role during registration.
- Provide a database-driven dropdown options architecture for departments, class levels, and room levels, **with real referential integrity** (v2 change — v1 stored these as free text).
- Add an Admin CRUD interface at `/staff/settings/dropdowns` to manage options in these dropdowns, including **Update**, not just List/Add/Delete.

---

## 2. Database Schema Changes (Supabase Migration)

`supabase/migrations/015_register_role_split.sql`

### A. Dropdown Tables (create first, since `users` will reference them)

```sql
CREATE TABLE public.dropdown_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX dropdown_departments_name_ci_uq ON public.dropdown_departments (lower(name));

CREATE TABLE public.dropdown_class_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX dropdown_class_levels_name_ci_uq ON public.dropdown_class_levels (lower(name));

CREATE TABLE public.dropdown_room_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX dropdown_room_levels_name_ci_uq ON public.dropdown_room_levels (lower(name));
```

**Why the change from v1**: v1 had a plain `UNIQUE` on `name`, no `is_active`, no `sort_order`. Admin panel needs `is_active` to do soft-delete ("List all active records" only makes sense if there's a status to filter on), and `sort_order` because class levels (ม.1, ม.2, ม.3...) and room levels need a fixed display order, not alphabetical or insertion order. The unique index is now case-insensitive (`lower(name)`) to stop "IT" / "it" duplicates.

### B. New Columns on `public.users` — now FK-based, not free text

```sql
ALTER TABLE public.users ADD COLUMN user_type VARCHAR(20) DEFAULT 'student'
  CHECK (user_type IN ('student', 'teacher', 'staff', 'external'));

ALTER TABLE public.users ADD COLUMN department_id UUID REFERENCES public.dropdown_departments(id);
ALTER TABLE public.users ADD COLUMN class_level_id UUID REFERENCES public.dropdown_class_levels(id);
ALTER TABLE public.users ADD COLUMN room_level_id UUID REFERENCES public.dropdown_room_levels(id);
```

**Why the change from v1**: v1 kept `department`/`class_level` as-is (implied free text) and added `room_level VARCHAR(50)` the same way. That means renaming or removing a dropdown option silently orphans historical data with no way to detect it, and "is this option in use" (needed for safe delete) becomes a fragile string comparison. Using FK columns gets us:
- Automatic protection against invalid values (can't insert a `department_id` that doesn't exist).
- A free, correct "in use" check for delete (see section 4).
- Renames in the dropdown table automatically reflect everywhere it's referenced.

> If the existing `department`/`class_level` columns already exist as VARCHAR from a prior migration and are in use elsewhere in the codebase, this needs a follow-up migration to backfill `*_id` from the text values and a decision on whether to drop the old text columns or keep them temporarily for backward compatibility. Flagging this as a dependency to check before running in production.

### C. RLS Policies

Unchanged from v1 — public read, admin-only write:

```sql
CREATE POLICY "dropdown_select_public" ON public.dropdown_departments FOR SELECT USING (true);
CREATE POLICY "dropdown_modify_admin" ON public.dropdown_departments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
-- repeat per table
```

(Public SELECT is intentional — the registration page is used pre-auth, so anonymous visitors need to read dropdown options.)

### D. Trigger Modification

```sql
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
```

**Why the change from v1**: v1 didn't handle what happens if `user_id_code` collides with an existing one — the insert would fail with a generic Postgres error that's hard to surface meaningfully to the user in the signup UI. Wrapping in an exception block with a named error lets the frontend show "รหัสนี้ถูกใช้ไปแล้ว" instead of a raw DB error. Also switched the metadata keys to `*_id` to match the new FK columns.

---

## 3. Frontend Architecture

### A. Package Installation

```bash
npm install react-thailand-address-typeahead
```

**Note (v2)**: confirmed this package exists on npm, but the base project (`zapkub/react-thailand-address-typeahead`) hasn't seen recent releases. A more actively maintained fork, `react-thailand-address-typeahead-split`, exists with releases as recent as ~3 months ago and adds province/amphoe/district IDs which may be useful for storing structured address data rather than a single string. Recommend the team pick one explicitly rather than defaulting to the original, and pin the version either way.

### B. Register UI (/app/register/page.tsx & /app/hooks/use-register-client.ts)

Same field/role mapping as v1, with two validation refinements:

- `external`: `user_id_code` (เลขบัตรประชาชน) — validate as exactly 13 digits **and** run the standard Thai national ID checksum-digit algorithm before accepting, not just a length check, to catch typos at input time rather than downstream.
- `student`: `user_id_code` (รหัสนักศึกษา) — the "≥ 12 characters" rule from v1 is very loose; replace with a regex matching the institution's actual student-ID format once confirmed (placeholder validation until that's provided).

Dropdown fields (`department`, `class_level`, `room_level`) now submit the selected option's **id** (UUID), not its display name, matching the new FK columns:

```ts
supabase.auth.signUp({
  // ...
  options: {
    data: {
      user_type,
      department_id,   // was department (name)
      class_level_id,  // was class_level (name)
      room_level_id,   // was room_level (name)
      // ...
    }
  }
})
```

### C. Registration Action Flow

Unchanged from v1 otherwise — `useRegisterClient` performs form-side validation before calling Supabase, then passes the metadata object above.

---

## 4. Admin Management Panel (/app/staff/settings/dropdowns)

- **Access Policy**: restricted to `role = 'admin'`; others redirected. Unchanged from v1.
- **Routing & Navigation**: unchanged from v1 — new route directory, conditional sidebar link via `StaffSidebar`.
- **Tabbed interface**: Departments / Class Levels / Room Levels — unchanged.

### CRUD operations (v2 — now genuinely complete)

- **List**: query `WHERE is_active = true ORDER BY sort_order`.
- **Add**: insert new row; rely on the case-insensitive unique index to reject duplicates with a friendly "มีตัวเลือกนี้อยู่แล้ว" message.
- **Update** *(new in v2 — missing from v1 despite the doc being titled "CRUD")*: allow editing `name` and `sort_order`. Because `users` now references these rows by `id`, a rename here is reflected everywhere automatically — no data migration needed.
- **Delete / Deactivate** *(clarified in v2)*: v1 said "ensure it is not in use before deletion" without saying how. With the FK in place:
  - Default action is **deactivate** (`is_active = false`), which immediately hides the option from new registrations while leaving existing users' references intact. This is the recommended default for admins.
  - **Hard delete** is only offered if a check (`SELECT count(*) FROM users WHERE department_id = :id`) returns zero, or the FK itself will reject the delete with a foreign-key-violation error that the UI can catch and turn into "ตัวเลือกนี้มีผู้ใช้งานอยู่ ไม่สามารถลบได้" — either way the DB is the source of truth for this check, not an app-side race-prone query.

---

## 5. Open Questions for Team (non-blocking, but worth a decision before build)

1. **Naming collision**: `role = 'staff'` (system permission tier) and `user_type = 'staff'` (registration category, meaning school personnel) use the same word for two different concepts. Recommend renaming the `user_type` value to something like `personnel` to avoid confusion in queries and code reviews later — this is a text-only change, low cost now, high cost after code references it in many places.
2. **Existing `department`/`class_level` columns**: if these already exist as text columns from an earlier migration, confirm whether to backfill into the new `*_id` columns and drop the old ones, or keep both temporarily.
3. **Student ID format**: need the actual format spec from the registrar to replace the placeholder "≥12 characters" rule with a real pattern.
4. **Address package choice**: pick between `react-thailand-address-typeahead` (original) and an actively maintained fork before implementation starts.