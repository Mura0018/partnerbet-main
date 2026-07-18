import { createAdminClient } from "@/lib/supabaseAdmin";

// Server-only access to api_credentials (football API key, push keys, etc).
// This table has zero RLS policies for anon/authenticated — only the
// service-role client used here can reach it, and only from server-only
// code (API routes). The actual secret value is NEVER sent back to the
// browser; callers only ever learn whether a key is configured.

export async function getApiCredential(key: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_credentials")
    .select("value")
    .eq("key", key)
    .eq("is_active", true)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setApiCredential(key: string, value: string, updatedBy: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("api_credentials").upsert(
    { key, value, is_active: true, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export async function getApiCredentialStatuses(keys: string[]): Promise<Record<string, boolean>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_credentials")
    .select("key, is_active")
    .in("key", keys);
  const statuses: Record<string, boolean> = {};
  for (const k of keys) statuses[k] = false;
  for (const row of data ?? []) {
    statuses[row.key] = !!row.is_active;
  }
  return statuses;
}
