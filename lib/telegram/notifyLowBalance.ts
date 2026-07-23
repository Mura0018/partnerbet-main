import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

// Past balans -> Telegramini ulagan super_admin(lar)ga xabar (best-effort).
// notifyOperatorsNewOrder naqshi kabi: xato yuborish hech qachon oqimni
// bloklamaydi. Chaqiruvchi tomon takroriy spam bo'lmasligi uchun
// low_balance_notified_at bilan cheklaydi (kassa balans endpointi).
export async function notifySuperAdminsLowBalance(
  cashdeskName: string,
  balance: number | null,
  threshold: number
): Promise<void> {
  const admin = createAdminClient();

  const { data: role } = await admin.from("roles").select("id").eq("key", "super_admin").maybeSingle();
  if (!role) return;

  const { data: staff } = await admin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("role_id", role.id)
    .eq("is_active", true)
    .not("telegram_chat_id", "is", null);

  const balStr = balance == null ? "?" : balance.toLocaleString("ru-RU");
  const text =
    `🟥 BETCORE PAY — PAST BALANS\n\n` +
    `🏦 Kassa: ${cashdeskName}\n` +
    `💰 Balans: ${balStr} so'm\n` +
    `⚠️ Chegara: ${threshold.toLocaleString("ru-RU")} so'm\n\n` +
    `Kassani to'ldirish kerak.`;

  await Promise.all(
    (staff ?? []).map((s) => (s.telegram_chat_id ? sendTelegramMessage(s.telegram_chat_id, text, undefined) : Promise.resolve()))
  );
}
