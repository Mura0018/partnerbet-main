import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";

// Server-only access to api_credentials (football API key, push keys,
// Telegram bot token, cashdesk credentials, etc). Values are encrypted at
// rest (AES-256-GCM, see lib/security/encryption.ts) — a database dump or
// leaked service-role key alone is no longer enough to read them, since
// ENCRYPTION_KEY lives only in server environment variables. The actual
// secret value is NEVER sent back to the browser; callers only ever learn
// whether a key is configured.
//
// NOTE: rows written before encryption was added are plain text and will
// no longer decrypt (decryptSecret throws, caught below and treated as
// "not configured") — every credential must be re-saved once after this
// change ships.

export async function getApiCredential(key: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_credentials")
    .select("value")
    .eq("key", key)
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    return decryptSecret(data.value);
  } catch {
    return null; // pre-encryption plaintext row or corrupted value — treat as not configured
  }
}

export async function setApiCredential(key: string, value: string, updatedBy: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("api_credentials").upsert(
    { key, value: encryptSecret(value), is_active: true, updated_by: updatedBy, updated_at: new Date().toISOString() },
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
