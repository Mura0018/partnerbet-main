import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";

// Shared, namespaced encrypted-credential storage used by BOTH Live
// Streaming (v1.1.0) and Donations (v1.2.0) — both features need
// "store an encrypted value per (entity, field)" and previously each
// wrote its own copy of the same encrypt/upsert/decrypt logic. This is
// the single implementation; lib/streaming/credentials.ts and
// lib/donations/credentials.ts are now thin, domain-named wrappers
// around it (kept separate so call sites in each feature's own code
// don't need to change, and so each domain keeps its own descriptive
// function names).

function buildKey(namespace: string, entityId: string, field: string): string {
  return `${namespace}:${entityId}:${field}`;
}

export async function setEncryptedCredential(
  namespace: string,
  entityId: string,
  field: string,
  plainValue: string,
  updatedBy: string
): Promise<void> {
  const supabase = createAdminClient();
  const encrypted = encryptSecret(plainValue);
  await supabase.from("api_credentials").upsert(
    { key: buildKey(namespace, entityId, field), value: encrypted, is_active: true, updated_by: updatedBy, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
}

export async function getEncryptedCredential(namespace: string, entityId: string, field: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("api_credentials")
    .select("value")
    .eq("key", buildKey(namespace, entityId, field))
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    return decryptSecret(data.value);
  } catch {
    return null; // corrupted/foreign-format value — treat as not configured rather than crashing
  }
}

export async function getEncryptedCredentialStatuses(
  namespace: string,
  entityId: string,
  fields: string[]
): Promise<Record<string, boolean>> {
  const supabase = createAdminClient();
  const keys = fields.map((f) => buildKey(namespace, entityId, f));
  const { data } = await supabase.from("api_credentials").select("key").in("key", keys).eq("is_active", true);
  const present = new Set((data ?? []).map((r) => r.key));
  const statuses: Record<string, boolean> = {};
  for (const field of fields) statuses[field] = present.has(buildKey(namespace, entityId, field));
  return statuses;
}
