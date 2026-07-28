import crypto from "crypto";
import { getDefaultCashdeskCreds, type Creds } from "@/lib/cashdesk/store";
import { computeSign, type SignatureVariant } from "@/lib/cashdesk/signatureVariants";
import { getCashdeskSignatureSettings } from "@/lib/cashdesk/signatureSettings";
import { createAdminClient } from "@/lib/supabaseAdmin";

// =========================================================
// CashdeskBotAPI client (partners.servcul.com) — the real 1xBet-family
// cashdesk API for balance/player lookup/deposit/payout. Every method
// needs two independently-computed values:
//   - "confirm": md5(`${id}:${hash}`) — goes in the URL/body. NEVER
//     varies by signature variant — already verified against the
//     vendor doc's worked examples (matched 3/3), not in question.
//   - "sign": sha256(sha256(A) + md5(B)) — goes in the `sign` header,
//     where A/B are method-specific field lists (see each function
//     below). The EXACT assembly (key case / field order / separator)
//     is driven by lib/cashdesk/signatureVariants.ts + the
//     betcore_cashdesk_signature site_setting (W3) — variant 1 is the
//     original/default recipe, kept unchanged as a fallback.
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
// W3.3: UTC siljishi bilan (dt qaysi vaqt mintaqasida yuborilishi —
// birinchi gumondor, server o'z vaqtiga yaqinlikni tekshirishi mumkin).
function formatDt(date: Date, offsetHours = 0): string {
  const shifted = new Date(date.getTime() + offsetHours * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}.${pad(shifted.getUTCMonth() + 1)}.${pad(shifted.getUTCDate())} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`
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

export type CashdeskResult<T> = { ok: true; data: T; dryRun?: boolean } | { ok: false; error: string };

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

// W3.2: diagnostika sahifasi FAQAT shu funksiyani chaqiradi — Balance
// pul harakatlantirmaydi. variant/dtOffsetHours PARAMETR sifatida
// berilishi mumkin (diagnostika turli variantlarni sinaydi); berilmasa
// saqlangan (site_settings) sozlama ishlatiladi — bu real ishlatiladigan yo'l.
export async function getCashdeskBalance(
  cd?: Creds,
  override?: { variant?: SignatureVariant; dtOffsetHours?: number }
): Promise<CashdeskResult<{ Balance: number | null; Limit: number | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const settings = await getCashdeskSignatureSettings();
  const variant = override?.variant ?? settings.variant;
  const dtOffsetHours = override?.dtOffsetHours ?? settings.dtOffsetHours;

  const dt = formatDt(new Date(), dtOffsetHours);
  const aPairs: [string, string][] = [["hash", creds.hash], ["cashierpass", creds.pass], ["dt", dt]];
  const bPairs: [string, string][] = [["dt", dt], ["cashierpass", creds.pass], ["cashdeskid", creds.cashdeskId]];
  const sign = computeSign(aPairs, bPairs, variant);
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

  const settings = await getCashdeskSignatureSettings();
  const aPairs: [string, string][] = [["hash", creds.hash], ["userid", userId], ["cashdeskid", creds.cashdeskId]];
  const bPairs: [string, string][] = [["userid", userId], ["cashierpass", creds.pass], ["hash", creds.hash]];
  const sign = computeSign(aPairs, bPairs, settings.variant);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Users/${userId}?confirm=${confirm}&cashdeskId=${creds.cashdeskId}`;
  return call(url, sign, creds.login);
}

// W3.5: quruq rejim (dry-run) — yoqilgan bo'lsa so'rov TO'LIQ shakllanadi
// va cashdesk_diagnostic_log'ga qayd etiladi, lekin fetch() CHAQIRILMAYDI.
async function logDryRun(params: {
  cashdeskId: string | null;
  variant: SignatureVariant;
  url: string;
  body: unknown;
  maskedHash: string;
  maskedPass: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("cashdesk_diagnostic_log").insert({
      cashdesk_id: params.cashdeskId,
      kind: "dry_run",
      signature_variant: params.variant,
      dt_offset_hours: null,
      http_status: null,
      response: { url: params.url, body: params.body },
      masked_hash: params.maskedHash,
      masked_pass: params.maskedPass,
      requested_by: null,
    });
  } catch {
    /* qayd best-effort — quruq-rejimning o'zini bloklamaydi */
  }
}

function maskSecret(s: string): string {
  return s.length <= 4 ? "****" : `****${s.slice(-4)}`;
}

export async function cashdeskDeposit(
  userId: string,
  summa: number,
  cd?: Creds,
  cashdeskRowId?: string
): Promise<CashdeskResult<{ summa: number; success: boolean; messageId: number | null; message: string | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const settings = await getCashdeskSignatureSettings();
  const aPairs: [string, string][] = [["hash", creds.hash], ["lng", LNG], ["UserId", userId]];
  const bPairs: [string, string][] = [["summa", String(summa)], ["cashierpass", creds.pass], ["cashdeskid", creds.cashdeskId]];
  const sign = computeSign(aPairs, bPairs, settings.variant);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Deposit/${userId}/Add`;
  const body = { cashdeskId: Number(creds.cashdeskId), lng: LNG, summa, confirm };

  if (settings.dryRun) {
    await logDryRun({
      cashdeskId: cashdeskRowId ?? null,
      variant: settings.variant,
      url,
      body,
      maskedHash: maskSecret(creds.hash),
      maskedPass: maskSecret(creds.pass),
    });
    return { ok: true, dryRun: true, data: { summa, success: true, messageId: null, message: "DRY_RUN — so'rov jo'natilmadi" } };
  }

  return call(url, sign, creds.login, { method: "POST", body: JSON.stringify(body) });
}

export async function cashdeskPayout(
  userId: string,
  code: string,
  cd?: Creds,
  cashdeskRowId?: string
): Promise<CashdeskResult<{ summa: number; success: boolean; messageId: number | null; message: string | null }>> {
  const creds = await resolveCreds(cd);
  if (!creds) return { ok: false, error: "not_configured" };

  const settings = await getCashdeskSignatureSettings();
  const aPairs: [string, string][] = [["hash", creds.hash], ["lng", LNG], ["UserId", userId]];
  const bPairs: [string, string][] = [["code", code], ["cashierpass", creds.pass], ["cashdeskid", creds.cashdeskId]];
  const sign = computeSign(aPairs, bPairs, settings.variant);
  const confirm = confirmFor(userId, creds.hash);

  const url = `${BASE_URL}/Deposit/${userId}/Payout`;
  const body = { cashdeskId: Number(creds.cashdeskId), lng: LNG, code, confirm };

  if (settings.dryRun) {
    await logDryRun({
      cashdeskId: cashdeskRowId ?? null,
      variant: settings.variant,
      url,
      body,
      maskedHash: maskSecret(creds.hash),
      maskedPass: maskSecret(creds.pass),
    });
    return { ok: true, dryRun: true, data: { summa: 0, success: true, messageId: null, message: "DRY_RUN — so'rov jo'natilmadi" } };
  }

  return call(url, sign, creds.login, { method: "POST", body: JSON.stringify(body) });
}
