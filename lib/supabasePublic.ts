import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Stateless, cookie-free anon client for Server Components that only need
// to read PUBLIC data (site_settings, published posts, etc.) at request
// time — e.g. injecting the admin-configured theme colour into <head>.
// Do NOT use this for anything that depends on the visitor's own session;
// use lib/supabaseServer.ts for that.
export function createPublicServerClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
