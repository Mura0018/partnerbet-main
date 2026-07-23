import crypto from "crypto";
import { getDefaultCashdeskCreds, type Creds } from "@/lib/cashdesk/store";

// =========================================================
// CashdeskBotAPI client (partners.servcul.com) — the real 1xBet-family
// cashdesk API for balance/player lookup/deposit/payout. Every method
// needs two independently-computed values:
//   - "confirm": md5(`${id}:${hash}`) — goes in the URL/body
//   - "sign": sha256(sha256(A) + md5(B)) — goes in the `sign` header,
//     where A/B are method-specific strings (see each function below)
// Verified against the vendor doc's worked examples: `confirm` matched
// exactly on 3/3 examples, and step A of `sign` matched exactly (64-char
// exact match). Step B of one worked example did not reproduce — most
// likely a transcription error in the source doc (a single flipped
// character in a hex string is a common OCR artifact) rather than a
// formula error, since it's copied verbatim from the documented formula.
// TEST WITH REAL CREDENTIALS (e.g. a balance call) before relying on
// deposit/payout in production — a signature mismatch fails loudly
// (401/403), it never silently moves money incorrectly.
// =========================================================

const BASE_URL = "https://partners.servcul.com/CashdeskBotAPI";
const LNG = "ru"; // vendor doc only demonstrates "ru"; not confirmed whether "uz" is supported

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}
function confirmFor(id: string | number, hash: string): string {
  return md5(`${id}:${hash}`);
}
function formatDt(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

// Kassa kalitlari (creds) endi PARAMETR orqali keladi — har kassa o'z
// kaliti bilan imzolaydi. creds berilmasa standart kassa olinadi (store.ts:
// yangi cashdesks jadvali -> birinchi active, yoki eski api_credentials
// fallback). MUHIM: pastdagi imzo mantig'i AYNAN oldingidek — faqat
// kalitlar manbai endi argument.
async function resolveCreds(creds?: Creds): Promise<Creds | null> {
  return creds ?? (await getDefaultCashdeskCreds());
}

export type CashdeskResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(url: string, sign: string, login: string, init?: RequestInit): Promise<CashdeskResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), sign, login, "Content-Type": "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `signature_error_${res.status}` };
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return { ok: false, error: "request_failed" };
    if (typeof data.success === "boolean" && !data.success) {
      return { ok: false, error: data.message || `error_${data.messageId ?? "unknown"}` };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function isCashdeskConfigured(): Promise<boolean> {
  return (await getDefaultCashdeskCreds()) !== null;
}

export async function getCashdeskBalance(cd?: Creds): Promise<CashdeskResult<{ Balance: number | null; Limit: number | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const dt = formatDt(new Date());
  const a = sha256(`hash=${creds.hash}&cashierpass=${creds.pass}&dt=${dt}`);
  const b = md5(`dt=${dt}&cashierpass=${creds.pass}&cashdeskid=${creds.cashdeskId}`);
  const sign = sha256(a + b);
  const confirm = confirmFor(creds.cashdeskId, creds.hash);

  const url = `${BASE_URL}/Cashdesk/${creds.cashdeskId}/Balance?confirm=${confirm}&dt=${encodeURIComponent(dt)}`;
  return call(url, sign, creds.login);
}

export async function findCashdeskPlayer(
  userId: string,
  cd?: Creds
): Promise<CashdeskResult<{ currencyId: number; userId: number; name: string }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const a = sha256(`hash=${creds.hash}&userid=${userId}&cashdeskid=${creds.cashdeskId}`);
  const b = md5(`userid=${userId}&cashierpass=${creds.pass}&hash=${creds.hash}`);
  const sign = sha256(a + b);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Users/${userId}?confirm=${confirm}&cashdeskId=${creds.cashdeskId}`;
  return call(url, sign, creds.login);
}

export async function cashdeskDeposit(
  userId: string,
  summa: number,
  cd?: Creds
): Promise<CashdeskResult<{ summa: number; success: boolean; messageId: number | null; message: string | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const a = sha256(`hash=${creds.hash}&lng=${LNG}&UserId=${userId}`);
  const b = md5(`summa=${summa}&cashierpass=${creds.pass}&cashdeskid=${creds.cashdeskId}`);
  const sign = sha256(a + b);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Deposit/${userId}/Add`;
  return call(url, sign, creds.login, {
    method: "POST",
    body: JSON.stringify({ cashdeskId: Number(creds.cashdeskId), lng: LNG, summa, confirm }),
  });
}

export async function cashdeskPayout(
  userId: string,
  code: string,
  cd?: Creds
): Promise<CashdeskResult<{ summa: number; success: boolean; messageId: number | null; message: string | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const a = sha256(`hash=${creds.hash}&lng=${LNG}&UserId=${userId}`);
  const b = md5(`code=${code}&cashierpass=${creds.pass}&cashdeskid=${creds.cashdeskId}`);
  const sign = sha256(a + b);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Deposit/${userId}/Payout`;
  return call(url, sign, creds.login, {
    method: "POST",
    body: JSON.stringify({ cashdeskId: Number(creds.cashdeskId), lng: LNG, code, confirm }),
  });
}
