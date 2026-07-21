import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const MINIAPP_ADMIN_URL = "https://www.couponbet.org/admin/telegram-bot";

// Pings every staff member who (a) has telegram_orders.manage permission
// via their role, (b) is active, and (c) has linked their own Telegram
// chat (see /api/admin/telegram-link). Best-effort: a missing link or a
// failed send never blocks order creation — see sendTelegramMessage.
export async function notifyOperatorsNewOrder(type: "topup" | "withdraw", amount: number, accountId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: permission } = await admin.from("permissions").select("id").eq("key", "telegram_orders.manage").maybeSingle();
  if (!permission) return;

  const { data: rolePermissions } = await admin.from("role_permissions").select("role_id").eq("permission_id", permission.id);
  const roleIds = (rolePermissions ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return;

  const { data: staff } = await admin
    .from("profiles")
    .select("telegram_chat_id")
    .in("role_id", roleIds)
    .eq("is_active", true)
    .eq("notify_orders", true)
    .not("telegram_chat_id", "is", null);

  const label = type === "topup" ? "Hisob to'ldirish" : "Pul yechish";
  const text =
    `🟦 BETCORE PAY\n\n🔔 Yangi buyurtma\n\n${label}\n💰 Summa: ${amount.toLocaleString("ru-RU")} so'm\n🆔 Hisob ID: ${accountId}\n\n` +
    `Ko'rib chiqish uchun admin panelga o'ting: ${MINIAPP_ADMIN_URL}`;

  await Promise.all((staff ?? []).map((s) => (s.telegram_chat_id ? sendTelegramMessage(s.telegram_chat_id, text, undefined) : Promise.resolve())));
}
