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
