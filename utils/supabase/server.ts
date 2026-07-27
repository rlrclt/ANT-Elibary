import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client สำหรับใช้ใน Server Components / Server Actions / Route Handlers
 * ใช้ @supabase/ssr กับ cookies() ของ Next 16 (async — ต้อง await)
 *
 * ใช้:
 *   import { createClient } from "@/utils/supabase/server";
 *   const supabase = await createClient();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ถูกเรียกจาก Server Component (read-only) — โอเค ปล่อยผ่าน
            // middleware จะจัดการ refresh session แทน
          }
        },
      },
    },
  );
}