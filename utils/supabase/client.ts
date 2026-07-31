import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Supabase client สำหรับใช้ใน Client Components
 * ใช้ @supabase/ssr เพื่อรองรับ cookie sync ตอน auth
 *
 * หมายเหตุ: lazy init — สร้าง client เฉพาะตอนเรียกใช้จริง (ใน browser)
 * ไม่สร้างตอน module load เพื่อหลีกเลี่ยง prerender error
 */
export function createClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ถ้า env ยังไม่ถูกตั้ง (เช่น build time หรือ prerender) → คืน dummy client
  // ที่มี type ตรงกับ SupabaseClient แต่ no-op (ไม่ throw)
  if (!url || !key || url === "" || key === "") {
    // ใช้ createBrowserClient กับค่า placeholder ที่ถูกต้องตาม format
    // เพื่อให้ type ตรง แต่จะไม่ถูกใช้จริง (client component จะ re-create ตอน hydrate)
    cachedClient = createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder-anon-key",
    );
    return cachedClient;
  }

  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}