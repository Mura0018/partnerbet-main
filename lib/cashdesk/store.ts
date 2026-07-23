import { createAdminClient } from "@/lib/supabaseAdmin";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { decryptSecret } from "@/lib/security/encryption";

// =========================================================
// Kassa (cashdesk) kalitlar manbai. client.ts endi IMZO uchun kalitlarni
// shu yerdan oladi (parametr sifatida). Har kassa o'z shifrlangan kaliti
// bilan (pass_enc / hash_enc, AES-256-GCM). Maxfiy kalitlar HECH QACHON
// brauzerga qaytmaydi — bu modul faqat server tomonda ishlaydi.
// =========================================================

export type Creds = { login: string; pass: string; hash: string; cashdeskId: string };

export type CashdeskRow = {
  id: string;
  name: string;
  cashdesk_id: string;
  login: string;
  owner_operator_id: string | null;
  is_active: boolean;
  region: string | null;
  low_balance_threshold: number | null;
  low_balance_notified_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// Maxfiy ustunlar (pass_enc / hash_enc) HECH QACHON bu ro'yxatda emas —
// admin panel/lists faqat shu ustunlarni ko'radi.
export const CASHDESK_PUBLIC_COLS =
  "id, name, cashdesk_id, login, owner_operator_id, is_active, region, low_balance_threshold, low_balance_notified_at, note, created_at, updated_at";

function credsFromRow(row: any): Creds | null {
  try {
    return {
      login: row.login,
      pass: decryptSecret(row.pass_enc),
      hash: decryptSecret(row.hash_enc),
      cashdeskId: row.cashdesk_id,
    };
  } catch {
    return null; // shifr buzuq / kalit noto'g'ri — sozlanmagan kabi
  }
}

// Bitta kassaning creds'i (id bo'yicha) — imzo uchun, server tomonda.
export async function getCashdeskCredsById(id: string): Promise<Creds | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cashdesks")
    .select("login, pass_enc, hash_enc, cashdesk_id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return credsFromRow(data);
}

// Standart (default) kassa. Hozir (1-bosqich) buyurtma->kassa yo'naltirish
// YO'Q (u keyingi bosqichlarda), shuning uchun default = birinchi active
// kassa. Yangi jadval bo'sh bo'lsa (ko'chirishdan oldin) eski
// api_credentials kassaga qaytadi — mavjud oqim BUZILMAYDI.
export async function getDefaultCashdeskCreds(): Promise<Creds | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cashdesks")
      .select("login, pass_enc, hash_enc, cashdesk_id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      const c = credsFromRow(data);
      if (c) return c;
    }
  } catch {
    /* jadval hali yo'q yoki xato -> pastdagi legacy fallback */
  }
  return getLegacyCreds();
}

// Eski (bitta kassa) api_credentials manbasi — orqaga moslik. Ko'chirish
// (import-legacy) bajarilgach yangi jadval ishlaydi, bu esa zaxira yo'l.
export async function getLegacyCreds(): Promise<Creds | null> {
  const [login, pass, hash, cashdeskId] = await Promise.all([
    getApiCredential("cashdesk_login"),
    getApiCredential("cashdesk_pass"),
    getApiCredential("cashdesk_hash"),
    getApiCredential("cashdesk_id"),
  ]);
  if (!login || !pass || !hash || !cashdeskId) return null;
  return { login, pass, hash, cashdeskId };
}

// Admin ro'yxati — maxfiy kalitlarsiz.
export async function listCashdesks(): Promise<CashdeskRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cashdesks")
    .select(CASHDESK_PUBLIC_COLS)
    .order("created_at", { ascending: true });
  return (data ?? []) as CashdeskRow[];
}
