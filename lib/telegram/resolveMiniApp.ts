import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";

// Bosqich 7.2: mini-app initData'sini HAM bizning bot, HAM hamkor botlari bilan
// tekshiradi. Qaysi token to'g'ri kelsa — o'sha kontekst (telegramId + partnerId).
// partnerId === null => bizning (platforma) app; aks holda hamkor app.
export type MiniAppContext = { telegramId: number; partnerId: string | null };

// Saqlangan token shifrlangan bo'lsa ochamiz; eski OCHIQ matn bo'lsa
// decryptSecret format xatosi beradi -> o'sha ochiq qiymat ishlatiladi (orqaga
// moslik — eski botlar buzilmaydi). wasPlaintext=true bo'lsa lazy migratsiya.
function readPartnerToken(stored: string | undefined): { token: string; wasPlaintext: boolean } | null {
  if (!stored || typeof stored !== "string") return null;
  try {
    return { token: decryptSecret(stored), wasPlaintext: false };
  } catch {
    return { token: stored, wasPlaintext: true };
  }
}

// enforceActive (default TRUE): hamkor topilganda partners.status='active'
// bo'lmasa (suspended/pending) null qaytaradi — ya'ni to'xtatilgan hamkor boti
// mijozlarni autentifikatsiya qilmaydi. Nice "bloklangan" ekran uchun
// resolveCustomerContext enforceActive:false bilan chaqirib, o'zi denied beradi.
export async function resolveMiniApp(initData: string, opts?: { enforceActive?: boolean }): Promise<MiniAppContext | null> {
  if (!initData) return null;
  const enforceActive = opts?.enforceActive !== false;

  // 1) Bizning bot
  const ourToken = await getApiCredential("telegram_bot_token");
  if (ourToken) {
    const v = verifyTelegramInitData(initData, ourToken);
    if (v) return { telegramId: v.telegramId, partnerId: null };
  }

  // 2) Hamkor botlari
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_api_credentials")
    .select("partner_id, credentials")
    .eq("provider", "telegram_bot")
    .eq("is_active", true);

  for (const row of (data ?? []) as any[]) {
    const parsed = readPartnerToken(row?.credentials?.token);
    if (!parsed) continue;

    const v = verifyTelegramInitData(initData, parsed.token);
    if (v) {
      // Status majburlash: faqat 'active' hamkor xizmat qiladi.
      if (enforceActive) {
        const { data: p } = await admin.from("partners").select("status").eq("id", row.partner_id).maybeSingle();
        if ((p as any)?.status !== "active") return null; // suspended/pending -> bloklangan
      }
      // Lazy migratsiya: mos kelgan eski OCHIQ tokenni shifrlab qayta yozamiz
      // (bir marta). O'qish baribir muvaffaqiyatli bo'ldi — migratsiya xato
      // bersa ham oqim buzilmaydi.
      if (parsed.wasPlaintext) {
        try {
          await admin
            .from("partner_api_credentials")
            .update({ credentials: { ...(row.credentials ?? {}), token: encryptSecret(parsed.token) } })
            .eq("partner_id", row.partner_id)
            .eq("provider", "telegram_bot");
        } catch { /* migratsiya ixtiyoriy — e'tiborsiz */ }
      }
      return { telegramId: v.telegramId, partnerId: row.partner_id as string };
    }
  }

  return null;
}
