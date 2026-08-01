# INIT — สรุปความรู้โปรเจกต์สำหรับ AI Agent

> ไฟล์นี้เป็น **project briefing** สำหรับ AI agent ตัวใหม่ ให้อ่านไฟล์นี้ก่อนเริ่มงาน
> เพื่อทำความเข้าใจโปรเจกต์โดยไม่ต้อง init/เรียนรู้ใหม่ทั้งหมด
> รายละเอียดเชิงปฏิบัติ (commands, conventions, ข้อห้าม) ดูที่ `AGENTS.md` ซึ่ง AI อ่านอัตโนมัติอยู่แล้ว

---

## 1. โปรเจกต์คืออะไร

**ANT E-Library** — ห้องสมุดดิจิทัลของ **วิทยาลัยเทคนิคอำนาจเจริญ** (Thai digital library)

- สมาชิก (member) ค้นหา/ดู/ยืมหนังสือทั้งอีบุ๊กและหนังสือจริง, ดูประวัติยืม-คืน, ค่าปรับ, ประกาศ, แบนเนอร์
- เจ้าหน้าที่ (staff) จัดการหนังสือ, สมาชิก, ยืม-คืน, ค่าปรับ, ประกาศ, แบนเนอร์, พิมพ์ป้ายบาร์โค้ด
- แอดมิน (admin) จัดการ dropdown (แผนก/ชั้น/ห้อง), บทบาทผู้ใช้
- UI ทั้งหมดเป็นภาษาไทย (แสดงผล + comment ในโค้ด)

**บทบาทผู้ใช้ (role)**: `member` / `staff` / `admin` — login ผ่าน Supabase Auth

## 2. Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 (App Router) — **มี breaking changes อ่าน docs ใน `node_modules/next/dist/docs/` ก่อน** |
| UI | React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, **ไม่มี** tailwind.config) |
| Database | Supabase Postgres + Auth + Storage (SSR client ผ่าน `@supabase/ssr`) |
| Icons | Phosphor Icons (CDN script ใน `app/layout.tsx`) |
| Font | Noto Sans Thai ผ่าน `next/font/google` |
| อื่นๆ | LINE (`@line/liff`, LINE Notify), barcode (`jsbarcode` + `jspdf` + `html2canvas`), `@hello-pangea/dnd` (drag-drop), `swiper` |

## 3. เริ่มต้นใช้งาน

```bash
npm install            # ติดตั้ง dependencies
npm run dev            # http://localhost:3000
npx tsc --noEmit       # ตรวจ type — ต้อง exit 0 ก่อนส่งงาน
npm run build          # production build
```

**Env variables** (ใน `.env.local`, ห้าม commit): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_APP_URL`

**ไม่มี test framework และไม่มี linter** — ห้ามสมมติ `npm test`/`npm run lint`
**การ migrate ฐานข้อมูลทำมือ** ผ่าน Supabase SQL Editor (ไฟล์ใน `supabase/migrations/NNN_*.sql`)

## 4. โครงสร้างโปรเจกต์

```
app/
  <route>/page.tsx          # Server Component — auth guard + fetch + render
  <route>/actions.ts        # "use server" — data mutations ทั้งหมดของ route นั้น
  <route>/components/*.tsx  # client components (page ดึงข้อมูลฝั่ง server แล้วส่ง props ลงมา)
  <route>/layout.tsx        # layout + ตรวจบทบาท
  components/               # shared (header, sidebar, modal, phosphor-icon, ...)
  hooks/                    # client hooks ใช้ useActionState wrapper
  types/                    # ambient .d.ts
  api/                      # Route Handlers
  actions/auth.ts           # login/register server actions
utils/
  supabase/{server,client,admin}.ts
  line-notify.ts, barcode-generator.tsx
supabase/migrations/        # NNN_*.sql เรียงลำดับ
meb-design-system/          # ระบบดีไซน์ (สี/ฟอนต์/คอมโพเนนต์)
docs/specs/ docs/superpowers/  # design spec & plans
```

เส้นทางหลัก: `/` landing, `/login`, `/register`, `/member/**`, `/staff/**`, `/auth/**`, `/api/**`

## 5. หลักการออกแบบแอป (สำคัญ)

- **Server Components เป็นค่าเริ่มต้น** — เติม `"use client"` เท่าที่จำเป็น
- **Server Actions** คืน state object `{ error?: string }`, ใช้ `revalidatePath()` หลังแก้ข้อมูล, `redirect()` หลัง login/action ที่เปลี่ยนหน้า
- Client ใช้ `useActionState` (React 19) + `useTransition` สำหรับโหลด
- **Auth guard**: `if (!user) redirect("/login")`; staff/admin ไป `/staff`, member ไป `/member`; ตรวจ role ใน layout
- `proxy.ts` (Next 16) ตั้ง header `x-pathname` — อ่านผ่าน `headers()` เพื่อรู้ pathname ใน layout
- หน้า print บาร์โค้ด (`/staff/books/print`) ไม่มี sidebar

## 6. รูปแบบการเขียนโค้ด

- Component/Page: PascalCase + named export (`export function PhosphorIcon`)
- Server action: `<verb>Action` (`getBooksAction`, `markAsReadAction`)
- ตัวแปร/ฟังก์ชัน: camelCase / DB column: snake_case / ชื่อไฟล์: kebab-case
- Type: `type` ใกล้จุดใช้งาน; type ที่ client ใช้ export จากไฟล์ actions (`export type BookWithCategory`)
- Comment + ข้อความ user-facing เป็นภาษาไทย (JSDoc `/** */` เหนือฟังก์ชัน)

### Supabase access (3 แบบ อย่าผิดวิธี)
1. `createClient()` จาก `@/utils/supabase/server` — **async ต้อง await**; ใช้ปกติทุก query (เคารพ RLS)
2. `createClient()` จาก `@/utils/supabase/client` — browser client แบบ cached/lazy
3. `createAdminClient()` จาก `@/utils/supabase/admin` (service_role) — **สำหรับ auth admin ops เท่านั้น** (create/delete user)

### Error handling
- Server Action: return `{ error: "ข้อความไทย" }` (ไม่ throw ขึ้น client); แปลง Supabase auth error ผ่าน `translateAuthError()`
- Server Component: `try-catch` query ที่ table อาจยังไม่มี → `return null` (ไม่งั้นหน้าค้าง ERR_ABORTED)
- UI: alert box เขียวสำเร็จ/แดง error + ปุ่ม disabled ตอน pending ("กำลังดำเนินการ...")

## 7. ระบบดีไซน์ (Meb)

- **Tokens เฉพาะ** ใน `app/globals.css` `@theme` (ดู `meb-design-system/SKILL.md` + `referencs/`)
- `meb-green #00a651` = ปุ่ม/action หลัก, active state, link
- `price-red #e53935` / `ribbon-red #e11d48` = ราคา/ส่วนลด/เร่งด่วน/error **เท่านั้น** — ห้ามเป็นปุ่มหลัก
- `forest`/`terracotta`/`cream`/`navy-ink` = หน้า landing/public; `meb-green` = หน้า member/staff
- ไอคอน: `PhosphorIcon` wrapper (`name` + `weight="fill"`) — ห้ามเพิ่ม library ไอคอนใหม่
- ฟอนต์: Noto Sans Thai (300–700) เท่านั้น
- Dark mode: class `.dark` บน `<html>` + `dark:` variant; สีแบรนด์คงเดิม
- Container: `max-w-[1200px]`, พื้นหลัง `bg-page-bg dark:bg-page-bg`, การ์ด `bg-card-bg border-border-base`

## 8. ฐานข้อมูล (Supabase)

ตารางหลัก: `users` (role, user_type, department_id/class_level_id/room_level_id FK), `book_categories`, `books`, `book_copies` (barcode ต่อเล่ม, status available/borrowed/lost/damaged), `borrow_records`, `fine_payments`, `announcements`/`announcement_reads`, `banners`, `room_access_logs`, `dropdown_*`

- **RLS เปิดทุกตาราง**; trigger `handle_new_auth_user` สร้างแถว `public.users` จาก auth metadata
- Trigger รักษา `books.total_copies`/`available_copies` ให้ sync กับ `book_copies`
- **ห้าม hard-delete แถวที่มีประวัติ** — ใช้ soft-delete (`status='removed'`/`'suspended'`/`is_active=false`); FK เป็น `ON DELETE RESTRICT`
- Migration ใหม่: ไฟล์ `NNN_ชื่อ.sql` ใน `supabase/migrations/` แล้วรันผ่าน Supabase SQL Editor

## 9. เอกสารที่ควรอ่านก่อนทำงาน

- `AGENTS.md` — กฎปฏิบัติ/commands/ข้อห้าม (อ่านอัตโนมัติ)
- `docs/specs/staff_books_management_system.md` — ระบบจัดการหนังสือฝั่ง staff
- `docs/superpowers/specs/2026-08-01-register-role-split-design.md` — การสมัครหลายบทบาท + admin dropdown CRUD
- `meb-design-system/SKILL.md` + `referencs/{design-tokens,components,page-patterns}.md` — กฎ UI
- `supabase/migrations/SCHEMA_DESIGN.md` — บันทึกตรวจสอบ schema

## 10. รูปแบบการทำงาน feature ใหม่

เมื่อ feature ครอบคลุมทั้ง server action + client UI + SQL ให้ทำตามลำดับ:
1. เขียน migration SQL (ถ้ามีตาราง/คอลัมน์ใหม่)
2. เขียน `actions.ts` (server actions + export types)
3. เขียน `page.tsx` (server component — auth guard + fetch + render)
4. เขียน `components/<feature>-client.tsx` (client component รับ props จาก page)
5. ตรวจ `npx tsc --noEmit` ต้องผ่านทุกขั้นตอน

---

*ไฟล์นี้คือความรู้ที่ init ไว้จากโครงสร้างโปรเจกต์จริง — ถ้าอัปเดตสถาปัตยกรรม/สแตก ให้แก้ไฟล์นี้ + `AGENTS.md` ให้ตรงกันด้วย*
