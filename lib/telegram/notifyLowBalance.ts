import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { fillRoleIds } from "@/lib/cashdesk/fillers";

// Past balans -> Telegram xabari (best-effort). Xato yuborish hech qachon
// oqimni bloklamaydi. Takroriy spam cheklovi CHAQIRUVCHIDA:
// lib/cashdesk/lowBalanceAlert.ts (cashdesks.low_balance_notified_at —
// bitta atomik qulf ikkala auditoriyani ham qoplaydi).
//
// Auditoriya:
//  1) super_admin'lar (Telegram ulangan, aktiv) — MAVJUD xulq, o'zgarmagan
//     (notify_cashdesk_low'ga qaramaydi).
//  2) 6b: 'cashdesks.fill' ruxsatli, aktiv, notify_cashdesk_low=true,
//     Telegram ulangan xodimlar — shu kassaga biriktirilganlar YOKI umuman
//     hech qaysi kassaga biriktirilmaganlar (= barcha kassalar).
// chat_id bo'yicha deduplikatsiya: bir odam ikki shartga tushsa ham bitta xabar.
// 2-auditoriya so'rovi xato bersa (masalan 0102 hali qo'yilmagan) — faqat
// 1-auditoriyaga yuboriladi.
export async function notifyLowBalance(
  cashdeskId: string,
  cashdeskName: string,
  balance: number | null,
  threshold: number
): Promise<void> {
  const admin = createAdminClient();
  const chatIds = new Set<number>();

  // ---- 1) super_admin (mavjud xulq) ----
  try {
    const { data: role } = await admin.from("roles").select("id").eq("key", "super_admin").maybeSingle();
    if (role) {
      const { data: staff } = await admin
        .from("profiles")
        .select("telegram_chat_id")
        .eq("role_id", role.id)
        .eq("is_active", true)
        .not("telegram_chat_id", "is", null);
      for (const s of staff ?? []) if (s.telegram_chat_id) chatIds.add(Number(s.telegram_chat_id));
    }
  } catch {
    /* best-effort */
  }

  // ---- 2) kassa to'ldiruvchilar ----
  try {
    const roleIds = await fillRoleIds(admin);
    if (roleIds.length > 0) {
      const { data: fillers, error } = await admin
        .from("profiles")
        .select("id, telegram_chat_id")
        .in("role_id", roleIds)
        .eq("is_active", true)
        .eq("notify_cashdesk_low", true)
        .not("telegram_chat_id", "is", null);
      if (error) throw error;

      const list = (fillers ?? []) as { id: string; telegram_chat_id: number | null }[];
      if (list.length > 0) {
        const { data: rows, error: rowsErr } = await admin
          .from("cashdesk_fillers")
          .select("cashdesk_id, user_id")
          .in("user_id", list.map((f) => f.id));
        if (rowsErr) throw rowsErr;

        const assigned = new Map<string, Set<string>>();
        for (const r of (rows ?? []) as { cashdesk_id: string; user_id: string }[]) {
          if (!assigned.has(r.user_id)) assigned.set(r.user_id, new Set());
          assigned.get(r.user_id)!.add(r.cashdesk_id);
        }
        for (const f of list) {
          const mine = assigned.get(f.id);
          // Biriktirilmagan -> barcha kassalar; biriktirilgan -> faqat o'zinikilar.
          if (!mine || mine.has(cashdeskId)) {
            if (f.telegram_chat_id) chatIds.add(Number(f.telegram_chat_id));
          }
        }
      }
    }
  } catch {
    /* 0102 yo'q yoki DB xatosi — faqat super_admin'larga ketadi */
  }

  if (chatIds.size === 0) return;

  const balStr = balance == null ? "?" : balance.toLocaleString("ru-RU");
  const text =
    `🟥 DedPay — past balans\n\n` +
    `Kassa: ${cashdeskName}\n` +
    `Balans: ${balStr} so'm\n` +
    `Chegara: ${threshold.toLocaleString("ru-RU")} so'm\n\n` +
    `Kassani to'ldirish kerak.`;

  await Promise.allSettled([...chatIds].map((c) => sendTelegramMessage(c, text, undefined)));
}
