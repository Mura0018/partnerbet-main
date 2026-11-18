import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyLowBalance } from "@/lib/telegram/notifyLowBalance";

// =========================================================
// Past balans alerti — ATOMIK throttling.
//
// Balans sahifasi (/api/admin/cashdesks/[id]/balance) va soatlik cron
// (/api/cron/check-cashdesk-balances) bir vaqtda ishlasa ham BITTA xabar
// ketishi kerak. Shuning uchun "o'qib-tekshirib-yozish" o'rniga shartli
// UPDATE ishlatiladi:
//
//   update cashdesks set low_balance_notified_at = now()
//   where id = $1 and (low_balance_notified_at is null
//                      or low_balance_notified_at < now() - cooldown)
//   returning id
//
// Postgres qatorni qulflaydi: ikkinchi parallel UPDATE birinchisi commit
// bo'lgach WHERE'ni qayta baholaydi va yangi qiymatni ko'rib 0 qator
// qaytaradi. Faqat qator QAYTARGAN chaqiruv xabar yuboradi.
//
// Best-effort: xato hech qachon chaqiruvchini bloklamaydi.
// =========================================================

export const LOW_BALANCE_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type LowBalanceInput = {
  id: string;
  name: string;
  balance: number | null;
  threshold: number | null;
};

export function isLowBalance(balance: number | null, threshold: number | null): boolean {
  return threshold != null && balance != null && balance < threshold;
}

// Natija: "notified" — shu chaqiruv xabar yubordi; "throttled" — boshqa
// chaqiruv yoki cooldown; "reset" — balans tiklandi, belgi tozalandi;
// "none" — hech narsa qilinmadi; "error" — DB xatosi (xabar ketmadi).
export type LowBalanceOutcome = "notified" | "throttled" | "reset" | "none" | "error";

export async function handleLowBalanceAlert(
  admin: SupabaseClient,
  input: LowBalanceInput
): Promise<LowBalanceOutcome> {
  try {
    if (isLowBalance(input.balance, input.threshold)) {
      const nowIso = new Date().toISOString();
      const cutoffIso = new Date(Date.now() - LOW_BALANCE_NOTIFY_COOLDOWN_MS).toISOString();
      const { data, error } = await admin
        .from("cashdesks")
        .update({ low_balance_notified_at: nowIso })
        .eq("id", input.id)
        .or(`low_balance_notified_at.is.null,low_balance_notified_at.lt.${cutoffIso}`)
        .select("id");
      if (error) return "error";
      if (!data || data.length === 0) return "throttled";
      await notifyLowBalance(input.id, input.name, input.balance, input.threshold as number);
      return "notified";
    }

    if (input.balance == null) return "none"; // balans noma'lum — belgiga tegmaymiz

    // Balans tiklandi -> keyingi tushishda yana xabar berish uchun tozalanadi.
    const { data, error } = await admin
      .from("cashdesks")
      .update({ low_balance_notified_at: null })
      .eq("id", input.id)
      .not("low_balance_notified_at", "is", null)
      .select("id");
    if (error) return "error";
    return data && data.length > 0 ? "reset" : "none";
  } catch {
    return "error";
  }
}
