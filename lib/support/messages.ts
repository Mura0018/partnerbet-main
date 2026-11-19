import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================
// Support chati — TIZIM xabari (salomlashuv, "band", "jamoaga yo'naltirildi",
// yakunlash javoblari). Hech kimning nomidan emas: is_system=true,
// operator_id NULL (0104). Haqiqiy operator javobidan ajraladi.
//
// Guarded fallback (0104 hali qo'yilmagan bo'lsa): is_system ustuni yo'q ->
// insert xato. fallbackOperatorId berilgan bo'lsa ESKI usulda (o'sha
// operator nomidan) yoziladi — oldingi xulq saqlanadi; berilmasa yuborilmaydi.
// =========================================================
export async function insertSupportSystemMessage(
  admin: SupabaseClient,
  customerId: string,
  message: string,
  fallbackOperatorId?: string | null
): Promise<boolean> {
  const { error } = await admin
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "operator", operator_id: null, is_system: true, message });
  if (!error) return true;

  if (fallbackOperatorId) {
    const { error: fbErr } = await admin
      .from("telegram_support_messages")
      .insert({ customer_id: customerId, sender: "operator", operator_id: fallbackOperatorId, message });
    return !fbErr;
  }
  return false;
}

// =========================================================
// Bir martalik "band / jamoaga yo'naltirildi" ogohlantirishi (1.1).
// Atomik: busy_notified_at NULL bo'lsagina now() yoziladi va faqat qator
// QAYTARGAN chaqiruv true oladi — parallel xabarlarda ham bitta ogohlantirish.
// 0104 yo'q bo'lsa (ustun yo'q) -> false: ogohlantirish yuborilmaydi
// (spam'dan ko'ra jimlik xavfsizroq).
// =========================================================
export async function claimSupportBusyNotice(admin: SupabaseClient, customerId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("telegram_support_threads")
    .update({ busy_notified_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("busy_notified_at", null)
    .select("customer_id");
  return !error && (data?.length ?? 0) > 0;
}

// Operator javob berganda / suhbat yakunlanganda belgilar tozalanadi —
// keyingi uzilishda mijoz yana bir marta xabardor qilinadi. Alohida
// so'rov: 0104 yo'q bo'lsa xato faqat shu yerda qoladi (asosiy update'ni
// buzmaydi). Best-effort.
export async function resetSupportNoticeFlags(admin: SupabaseClient, customerId: string): Promise<void> {
  try {
    await admin.from("telegram_support_threads").update({ busy_notified_at: null }).eq("customer_id", customerId);
  } catch {
    /* best-effort */
  }
}
