import crypto from "crypto";

// AES-256-GCM encryption for streaming provider credentials (API key /
// secret). Unlike the plain api_credentials pattern used elsewhere
// (Football providers, Push VAPID keys — protected by access control
// only: zero RLS policies, server-only reads), streaming credentials are
// additionally ENCRYPTED AT REST here, per the explicit requirement for
// this feature. Even a direct database dump would not reveal plaintext
// values without ENCRYPTION_KEY (kept only in server environment
// variables, never in the database).
//
// This does not replace the api_credentials access-control model — it
// stores the encrypted string INSIDE that same table, adding a second,
// independent layer of protection (encryption + access control).

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY environment o'zgaruvchisi topilmadi — streaming provider kalitlarini shifrlash uchun shart."
    );
  }
  // Derive a fixed 32-byte key from whatever-length secret is provided.
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Shifrlangan qiymat formati noto'g'ri.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
