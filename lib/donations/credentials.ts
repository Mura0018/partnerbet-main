import { setEncryptedCredential, getEncryptedCredential, getEncryptedCredentialStatuses } from "@/lib/security/encryptedCredentials";

// Thin, domain-named wrapper around the shared encrypted-credential store
// (lib/security/encryptedCredentials.ts) — namespaced "donation". Field
// names are flexible (not a fixed union) because different gateways need
// different credential shapes: Stripe uses secret_key + webhook_secret;
// PayPal uses client_id + client_secret + webhook_id.

export async function setPaymentMethodCredential(
  paymentMethodId: string,
  field: string,
  plainValue: string,
  updatedBy: string
): Promise<void> {
  return setEncryptedCredential("donation", paymentMethodId, field, plainValue, updatedBy);
}

export async function getPaymentMethodCredential(paymentMethodId: string, field: string): Promise<string | null> {
  return getEncryptedCredential("donation", paymentMethodId, field);
}

export async function getPaymentMethodCredentialStatuses(paymentMethodId: string, fields: string[]): Promise<Record<string, boolean>> {
  return getEncryptedCredentialStatuses("donation", paymentMethodId, fields);
}
