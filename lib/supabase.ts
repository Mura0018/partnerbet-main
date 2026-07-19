import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Client-side Supabase instance — used in the browser (public anon key only).
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
