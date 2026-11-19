import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { env } from "@/lib/env";
import { serverT, normalizeLocale } from "@/lib/i18n/server";

const MINIAPP_ADMIN_URL = `${env.siteUrl}/admin/telegram-bot`;

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
    `🟦 DedPay\n\n🔔 Yangi buyurtma\n\n${label}\nSumma: ${amount.toLocaleString("ru-RU")} so'm\nHisob ID: ${accountId}\n\n` +
    `Ko'rib chiqish uchun admin panelga o'ting: ${MINIAPP_ADMIN_URL}`;

  await Promise.all((staff ?? []).map((s) => (s.telegram_chat_id ? sendTelegramMessage(s.telegram_chat_id, text, undefined) : Promise.resolve())));
}

// =========================================================
// 2.1 — Mijoz support'da yozganda mas'ul operatorga Telegram xabari.
// notifyOperatorsNewOrder bilan bir xil naqsh (telegram_orders.manage, aktiv,
// notify_orders, Telegram ulangan), qo'shimchasi:
//  - THROTTLE: telegram_support_threads.operator_notified_at — atomik shartli
//    update (null yoki SUPPORT_NOTIFY_COOLDOWN_MS dan eski -> now). Faqat qator
//    QAYTARGAN chaqiruv yuboradi: bir suhbatda qisqa oraliqda bitta xabar.
//    Operator javob berganda NULL qilinadi (resetSupportNoticeFlags) — hisob
//    qaytadan boshlanadi.
//  - QABUL QILUVCHI: thread egasi (claimed_by); egasi yo'q yoki Telegram
//    ulamagan bo'lsa — barcha telegram_orders.manage xodimlari (chat_id dedup).
//  - Matn xodimning profiles.locale tilida (uz/ru).
// Best-effort: hech qachon throw qilmaydi. 0104 qo'yilmagan bo'lsa (ustun
// yo'q) throttle update xato beradi -> xabar YUBORILMAYDI (spam emas).
// =========================================================
export const SUPPORT_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

export type SupportPreview = { kind: "text"; text: string } | { kind: "image" } | { kind: "voice" };

type StaffRow = { telegram_chat_id: number | null; locale: string | null };

export async function notifyOperatorsSupportMessage(customerId: string, preview: SupportPreview): Promise<void> {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(Date.now() - SUPPORT_NOTIFY_COOLDOWN_MS).toISOString();

    const { data: claimed, error: claimErr } = await admin
      .from("telegram_support_threads")
      .update({ operator_notified_at: nowIso })
      .eq("customer_id", customerId)
      .or(`operator_notified_at.is.null,operator_notified_at.lt.${cutoffIso}`)
      .select("claimed_by");
    if (claimErr || !claimed || claimed.length === 0) return;
    const ownerId = (claimed[0] as { claimed_by: string | null }).claimed_by;

    // Qabul qiluvchilar: avval egasi, bo'lmasa jamoa.
    let recipients: StaffRow[] = [];
    if (ownerId) {
      const { data: owner } = await admin
        .from("profiles")
        .select("telegram_chat_id, locale")
        .eq("id", ownerId)
        .eq("is_active", true)
        .eq("notify_orders", true)
        .not("telegram_chat_id", "is", null)
        .maybeSingle();
      if (owner) recipients = [owner as StaffRow];
    }
    if (recipients.length === 0) {
      const { data: permission } = await admin.from("permissions").select("id").eq("key", "telegram_orders.manage").maybeSingle();
      if (!permission) return;
      const { data: rolePermissions } = await admin.from("role_permissions").select("role_id").eq("permission_id", permission.id);
      const roleIds = (rolePermissions ?? []).map((r) => r.role_id);
      if (roleIds.length === 0) return;
      const { data: staff } = await admin
        .from("profiles")
        .select("telegram_chat_id, locale")
        .in("role_id", roleIds)
        .eq("is_active", true)
        .eq("notify_orders", true)
        .not("telegram_chat_id", "is", null);
      recipients = (staff ?? []) as StaffRow[];
    }
    if (recipients.length === 0) return;

    const { data: cust } = await admin.from("customers").select("full_name, phone").eq("id", customerId).maybeSingle();
    const name = (cust as { full_name: string | null; phone: string | null } | null)?.full_name
      || (cust as { phone: string | null } | null)?.phone
      || "—";

    const seen = new Set<number>();
    const sends: Promise<void>[] = [];
    for (const r of recipients) {
      const chatId = Number(r.telegram_chat_id);
      if (!Number.isFinite(chatId) || seen.has(chatId)) continue;
      seen.add(chatId);
      const loc = normalizeLocale(r.locale) ?? "uz";
      const body =
        preview.kind === "text"
          ? preview.text.length > 200 ? `${preview.text.slice(0, 200)}…` : preview.text
          : serverT(loc, preview.kind === "image" ? "spb.staffImage" : "spb.staffVoice");
      const text =
        `${serverT(loc, "spb.staffTitle")}\n\n` +
        `${serverT(loc, "spb.staffCustomer")}: ${name}\n${body}\n\n` +
        `${serverT(loc, "spb.staffOpen")}: ${MINIAPP_ADMIN_URL}`;
      sends.push(sendTelegramMessage(chatId, text, undefined));
    }
    await Promise.allSettled(sends);
  } catch {
    /* best-effort */
  }
}
