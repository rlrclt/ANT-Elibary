import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with service_role privileges
 * Used only on the server-side to perform admin operations (like creating/deleting users in auth.users)
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
