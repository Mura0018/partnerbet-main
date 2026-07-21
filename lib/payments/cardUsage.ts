import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

// Called once a topup order is actually created against a specific card
// (not just shown) — increments that card's usage_count, and if the
// operator set a usage_limit on it, retires the card (is_active=false)
// once the limit is hit so it stops being handed out, then pings the
// operator on Telegram to add a replacement.
export async function bumpCardUsage(operatorId: string, accountNumber: string): Promise<void> {
  const admin = createAdminClient();

  const { data: method } = await admin
    .from("telegram_operator_payment_methods")
    .select("id, usage_count, usage_limit")
    .eq("operator_id", operatorId)
    .eq("account_number", accountNumber)
    .eq("is_active", true)
    .maybeSingle();
  if (!method) return;

  const newCount = (method.usage_count ?? 0) + 1;
  const limitHit = method.usage_limit != null && newCount >= method.usage_limit;

  await admin
    .from("telegram_operator_payment_methods")
    .update({ usage_count: newCount, is_active: limitHit ? false : undefined })
    .eq("id", method.id);

  if (limitHit) {
    const { data: operator } = await admin.from("profiles").select("telegram_chat_id").eq("id", operatorId).maybeSingle();
    if (operator?.telegram_chat_id) {
      await sendTelegramMessage(
        operator.telegram_chat_id,
        `🟦 BETCORE PAY\n\n⚠️ Rekvizit limiti tugadi\n\n"${accountNumber}" — ${method.usage_limit} marta ishlatildi va endi o'chirildi.\n\nAdmin panelda "Mening to'lovlarim" bo'limiga kirib, o'rniga yangi rekvizit qo'shing.`,
        undefined
      );
    }
  }
}
