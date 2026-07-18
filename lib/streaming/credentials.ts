import { setEncryptedCredential, getEncryptedCredential, getEncryptedCredentialStatuses } from "@/lib/security/encryptedCredentials";

// Thin, domain-named wrapper around the shared encrypted-credential store
// (lib/security/encryptedCredentials.ts) — namespaced "streaming" so its
// keys never collide with Donation (v1.2.0) or any future feature's
// credentials in the same api_credentials table.

export async function setProviderCredential(
  providerId: string,
  field: "api_key" | "api_secret",
  plainValue: string,
  updatedBy: string
): Promise<void> {
  return setEncryptedCredential("streaming", providerId, field, plainValue, updatedBy);
}

export async function getProviderCredential(providerId: string, field: "api_key" | "api_secret"): Promise<string | null> {
  return getEncryptedCredential("streaming", providerId, field);
}

export async function getProviderCredentialStatus(providerId: string): Promise<{ hasApiKey: boolean; hasApiSecret: boolean }> {
  const statuses = await getEncryptedCredentialStatuses("streaming", providerId, ["api_key", "api_secret"]);
  return { hasApiKey: statuses.api_key, hasApiSecret: statuses.api_secret };
}
