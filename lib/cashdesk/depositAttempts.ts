import { createAdminClient } from "@/lib/supabaseAdmin";

// =========================================================
// BOSQICH D — DEPOZIT URINISHLARI AUDITI (bloklashsiz).
// payoutAttempts.ts naqshining soddalashtirilgani: depozitni operator
// boshlaydi, "noto'g'ri kod" tushunchasi yo'q — shuning uchun limit/blok
// mantig'i YO'Q, faqat doimiy qayd (deposit_attempts jadvali, service-role
// insert). Har urinish (muvaffaqiyatli HAM, xato HAM) yoziladi, o'chirilmaydi.
// =========================================================
export async function recordDepositAttempt(params: {
  orderId: string;
  customerId: string;
  playerId: string;
  amount: number | null;
  ok: boolean;
  error: string | null;
  ip: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("deposit_attempts").insert({
      order_id: params.orderId,
      customer_id: params.customerId,
      player_id: params.playerId,
      amount: params.amount,
      ok: params.ok,
      error: params.error,
      ip: params.ip,
    });
  } catch {
    /* qayd best-effort — depozit natijasini bloklamaydi */
  }
}
