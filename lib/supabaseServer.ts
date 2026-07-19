import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Server Component / Route Handler Supabase client bound to the request's
// own cookies — reads/writes the visitor's real session (respects RLS as
// that specific user). Use this in Route Handlers and Server Components,
// NOT lib/supabaseAdmin.ts (which bypasses RLS entirely).
//
// persistSession=false strips maxAge/expires from the auth cookies so they
// become session-only (cleared when the browser closes) — this is what
// powers the "Remember me" checkbox on the login form; it is not decorative.
export async function createServerSupabaseClient(options?: { persistSession?: boolean }) {
  const persistSession = options?.persistSession ?? true;
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, cookieOptions) => {
        try {
          const finalOptions = persistSession
            ? cookieOptions
            : { ...cookieOptions, maxAge: undefined, expires: undefined };
          cookieStore.set(name, value, finalOptions);
        } catch {
          // Called from a Server Component render (not a Route Handler) —
          // cookies are read-only there; middleware handles refresh instead.
        }
      },
      remove: (name, cookieOptions) => {
        try {
          cookieStore.set(name, "", { ...cookieOptions, maxAge: 0 });
        } catch {}
      },
    },
  });
}
