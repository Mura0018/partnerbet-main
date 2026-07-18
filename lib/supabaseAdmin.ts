import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Server-only Supabase client with elevated (service role) permissions.
// NEVER import this file in a client component — it must only run on the server
// (API routes, server actions) because SUPABASE_SERVICE_ROLE_KEY bypasses
// Row Level Security.
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
