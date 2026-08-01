<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Relevant Resources & Tools (Automated Engine Directives)

**CRITICAL MANDATE**: You MUST automatically reference, invoke, and utilize the following resources when working on this project without waiting for explicit user prompts:

- **[Caveman](https://github.com/JuliusBrussee/caveman/blob/main/README.md)**
  - *Automatic Use*: Apply clean boilerplate patterns, minimalist module architecture, and straightforward project structures.
- **[Superpowers](https://github.com/obra/superpowers/)**
  - *Automatic Use*: Execute agentic development workflows automatically (TDD, Systematic Debugging, Brainstorming, Subagent Execution, and Empirical Verification).
- **[TOON (Token-Oriented Object Notation)](https://github.com/toon-format/toon)**
  - *Automatic Use*: Serialize JSON data, arrays, and prompt context into TOON format for token-efficient LLM prompts.
- **[Headroom](https://github.com/headroomlabs-ai/headroom)**
  - *Automatic Use*: Manage workspace skills, headroom context limits, and plugin extensions automatically.

# Project: ANT E-Library

Thai digital library (ห้องสมุดดิจิทัล) for วิทยาลัยเทคนิคอำนาจเจริญ. Members browse/search/borrow e-books and physical books; staff manage books, members, loans, fines, announcements, banners; admins manage dropdowns, roles. All UI text and comments are in Thai.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (via `@tailwindcss/postcss`, no `tailwind.config`) — tokens defined in `app/globals.css` `@theme`
- **Supabase** (Postgres + Auth + Storage) — SSR client via `@supabase/ssr`
- **Phosphor Icons** (CDN `<script>` loaded in `app/layout.tsx`), **Noto Sans Thai** via `next/font/google`
- LINE integration (`@line/liff`, LINE Notify), barcode printing (`jsbarcode`, `jspdf`, `html2canvas`)

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run start    # start production server
npx tsc --noEmit # TYPE CHECK — the standard verification. Must exit 0 before finishing any task.
```

- **There is NO test framework and NO linter configured.** Do not invent `npm test`/`npm run lint`.
- Verify every change with `npx tsc --noEmit` (exit code 0 = clean). A stale VS Code TS server may show false "module not found" diagnostics for newly created files — `tsc` is the source of truth.
- Database migrations are applied manually via the Supabase SQL Editor. Migration files live in `supabase/migrations/NNN_*.sql` (numbered, idempotent style: `CREATE OR REPLACE`, `DROP ... IF EXISTS`).
- Deployment is Vercel (`vercel.json` defines a cron hitting `/api/line/dispatch`).

## Environment Variables (in `.env.local`, never committed)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_APP_URL`.

## Architecture & Conventions

### Routing / feature structure (App Router)
```
app/
  <route>/page.tsx              # Server Component: auth guard + fetch + render
  <route>/actions.ts            # "use server" — all data mutations for that route
  <route>/components/*.tsx      # client components (page pulls data server-side, passes props down)
  <route>/layout.tsx            # layout with auth guard + role check
app/components/                 # shared components (header, sidebar, modal, phosphor-icon, ...)
app/hooks/                      # shared client hooks (useActionState wrappers)
app/types/                      # ambient .d.ts overrides
utils/supabase/                 # client.ts / server.ts / admin.ts
```

- **Server Components by default.** Add `"use client"` only when a component needs state/effects/events.
- **Server Actions** (`"use server"` files): return a typed state object `{ error?: string }`; use `revalidatePath()` after mutations and `redirect()` for post-auth flows. Wrap with `useActionState` (React 19) in client components; use `useTransition` for refetch/pending states.
- Pages/layouts export `metadata` with Thai titles; layouts use `title.template`.
- **Auth guards**: `if (!user) redirect("/login")` in layouts/pages; role checks redirect non-staff to `/member` and vice-versa. `StaffLayout` also handles the print page (`/staff/books/print`, no sidebar).
- `proxy.ts` (Next 16 proxy) sets `x-pathname` header on every request; read it via `headers()` to know the pathname in layouts.

### Supabase access patterns
- **`createClient()` from `@/utils/supabase/server`** (async — `await` it; SSR, respects RLS). Use for all normal queries/mutations.
- **`createClient()` from `@/utils/supabase/client`** — cached, lazy browser client (returns a no-op placeholder if env missing so prerender doesn't crash).
- **`createAdminClient()` from `@/utils/supabase/admin`** (service_role) — ONLY for auth admin ops (creating/deleting auth users). Never use it for normal data access.
- Prefer `.select(...).eq(...).maybeSingle()`, multi-column search via `.or("title.ilike.%s%,author.ilike.%s%")`, and `Promise.all` to parallelize independent queries. `head: true` + `count: "exact"` for counts.
- Always `try-catch` queries against tables that may not exist yet (e.g. newer migrations) and `return null` on error — an uncaught query error makes the page hang (ERR_ABORTED).

### Naming conventions
- **Components/Pages**: PascalCase, named exports (`export function PhosphorIcon`, `export default function MemberPage`). Feature clients are `<Feature>Client.tsx` (e.g. `announcements-client.tsx`).
- **Server actions**: `<verb>Action` (e.g. `registerAction`, `getBooksAction`, `markAsReadAction`); actions files often export their param/result types.
- **Variables/functions/fields**: camelCase; DB columns are snake_case. File names are kebab-case.
- **Types**: prefer inline `type` declarations near where they're used; export types consumed by client components from the actions file (`export type BookWithCategory`).

### Styling — Meb design system (see `meb-design-system/SKILL.md`)
- **Color tokens only** (defined in `app/globals.css` `@theme`, used as Tailwind classes): `meb-green` `#00a651` (primary action/buttons/links/active), `meb-hover`, `meb-light`, `meb-nav`, `price-red` `#e53935`, `ribbon-red` `#e11d48`, `page-bg`, `card-bg`, `border-base`, `cream`, `forest`, `navy-ink`, `terracotta` (accent), `info-yellow-*`, `info-blue-*`.
- **Green = primary action. Red = prices/discounts/urgency/errors ONLY — never a primary button.** Forest/terracotta are used on public/landing pages; meb-green on member/staff pages.
- **Icons**: use the `PhosphorIcon` wrapper (`app/components/phosphor-icon.tsx`, prop `name` + optional `weight="fill"`). Do NOT add new icon libraries.
- **Font**: Noto Sans Thai (300–700). Never substitute another Thai font.
- **Dark mode**: class strategy via `.dark` on `<html>`; write `dark:` variants for page bg / card / border / text. Brand colors stay the same.
- Layout utilities: `bg-page-bg dark:bg-page-bg`, cards `bg-card-bg border-border-base`, `transition-colors duration-300`. Max content width `max-w-[1200px]`. Buttons use `rounded-md`/`rounded-full` + `font-bold`.

### Error handling
- Server Actions return `{ error: "ข้อความภาษาไทย" }` (never throw to the client); translate Supabase auth errors via a local `translateAuthError()` helper.
- Client components show inline alert boxes (green success, red error) and disable submit while pending (spinner icon + "กำลังดำเนินการ...").
- Server components `try-catch` fragile queries and degrade gracefully (return null / empty).
- API route handlers (`app/api/**/route.ts`) return `NextResponse` with proper status codes.

### Comments & language
- Comments and user-facing strings are in **Thai**. Keep existing comment style (JSDoc `/** */` above functions explaining purpose/flow). Add comments where non-obvious, not for trivial code.

### Database / migrations (Supabase)
- Tables: `users` (role: member/staff/admin, user_type, department_id/class_level_id/room_level_id FKs), `book_categories`, `books`, `book_copies` (barcode per copy; `status` available/borrowed/lost/damaged), `borrow_records`, `fine_payments`, `announcements`/`announcement_reads`, `banners`, `room_access_logs`, `dropdown_*`.
- RLS enabled on all tables; `handle_new_auth_user` trigger creates `public.users` row from auth metadata. Triggers keep `books.total_copies`/`available_copies` in sync. Never hard-delete rows with history — soft-delete (`status = 'removed'`/`'suspended'`/`is_active = false`).

## Key Docs to Read Before Coding

- `docs/specs/staff_books_management_system.md` — staff book management system design
- `docs/superpowers/specs/2026-08-01-register-role-split-design.md` — multi-role registration + admin dropdown CRUD
- `meb-design-system/SKILL.md` + `meb-design-system/referencs/{design-tokens,components,page-patterns}.md` — UI rules
- `supabase/migrations/SCHEMA_DESIGN.md` — schema review notes
- When a feature spans server action + client UI + SQL, follow the established pattern: migration → `actions.ts` → `page.tsx` → `components/*-client.tsx`, verifying each step with `npx tsc --noEmit`.
