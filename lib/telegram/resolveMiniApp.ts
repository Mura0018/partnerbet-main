import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Bosqich 7.2: mini-app initData'sini HAM bizning bot, HAM hamkor botlari bilan
// tekshiradi. Qaysi token to'g'ri kelsa — o'sha kontekst (telegramId + partnerId).
// partnerId === null => bizning (platforma) app; aks holda hamkor app.
// verifyTelegramInitData mahalliy HMAC — tarmoqsiz, shuning uchun N ta tokenni
// sinash arzon.
export type MiniAppContext = { telegramId: number; partnerId: string | null };

export async function resolveMiniApp(initData: string): Promise<MiniAppContext | null> {
  if (!initData) return null;

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
    const token = row?.credentials?.token;
    if (!token) continue;
    const v = verifyTelegramInitData(initData, token);
    if (v) return { telegramId: v.telegramId, partnerId: row.partner_id as string };
  }

  return null;
}
