import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { cashdeskPayout, isCashdeskConfigured } from "@/lib/cashdesk/client";
import { getCashdeskCredsById, type Creds } from "@/lib/cashdesk/store";
import { checkPayoutBlocked, recordPayoutAttempt } from "@/lib/cashdesk/payoutAttempts";
import { sendTelegramMessage } from "@/lib/telegram/notify";
import { getClientIp } from "@/lib/security/rateLimit";

const PAYOUT_TIMEOUT_MS = 8000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([p, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);
}

async function requireOrdersManage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

// W2.2/W2.3/W2.6 — "[1] 1xbetdan yechib olish" tugmasining orqasi.
// Mijoz cashdeskPayout'ni HECH QACHON chaqirmaydi — bu FAQAT shu yerda,
// operator bosganda ishga tushadi. Atomik holat o'tishi (none -> pending)
// ikki marta bosishdan/parallel bosishdan himoya qiladi.
export async function POST(req: NextRequest) {
  const check = await requireOrdersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { orderId, manual } = body ?? {};
  if (!orderId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, type, status, account_id, withdraw_code, payout_status, cashdesk_id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order as any).type !== "withdraw" || (order as any).status !== "pending") {
    return NextResponse.json({ error: "not_found_or_already_resolved" }, { status: 409 });
  }
  if ((order as any).payout_status === "success") {
    // Idempotent no-op: allaqachon bajarilgan — ikki marta bosish zarar keltirmaydi.
    return NextResponse.json({ ok: true, alreadyDone: true, payoutStatus: "success" });
  }

  const customerId = (order as any).customer_id as string;
  const playerId = String((order as any).account_id);

  // W2 QO'SHIMCHA: abuse-himoya — mijoz yoki shu player_id bloklangan bo'lsa
  // (ketma-ket muvaffaqiyatsiz urinishlar tufayli) yangi urinishga ruxsat yo'q.
  // Faqat HAQIQIY API yo'lida tekshiriladi — qo'lda (manual) rejim operator
  // tomonidan ko'z bilan tasdiqlangani uchun bundan mustasno.
  if (!manual) {
    const blockCheck = await checkPayoutBlocked(customerId, playerId);
    if (blockCheck.blocked) {
      return NextResponse.json({ error: "payout_blocked", reason: blockCheck.reason, until: blockCheck.until }, { status: 403 });
    }
  }

  // ATOMIK: faqat 'none' holatida bo'lsa 'pending'ga o'tkazamiz + urinish
  // sanog'ini oshiramiz — IKKALASI HAM bitta UPDATE ichida, xuddi shu
  // WHERE payout_status='none' bilan qo'riqlanadi. Qator yangilanmasa —
  // boshqa kimdir ALLAQACHON bosgan (yoki hali noaniq holatda kutilmoqda)
  // — TO'XTA (attempts ham bu holatda oshmaydi, chunki update umuman
  // tatbiq etilmaydi).
  const { data: currentRow } = await admin.from("telegram_orders").select("payout_attempts").eq("id", orderId).maybeSingle();
  const nextAttempts = ((currentRow as any)?.payout_attempts ?? 0) + 1;

  const { data: locked } = await admin
    .from("telegram_orders")
    .update({ payout_status: "pending", payout_attempts: nextAttempts })
    .eq("id", orderId)
    .eq("payout_status", "none")
    .select("id");

  if (!locked || locked.length === 0) {
    return NextResponse.json({ error: "already_in_progress" }, { status: 409 });
  }

  // Qo'lda rejim (W2.5): kalitlar hali yo'q bo'lganda operator MobCash
  // ilovasida qo'lda yechadi va shu yerda "1xbetdan yechib oldim" deb
  // belgilaydi. Faqat HAQIQATAN kalitlar yo'q bo'lganda qabul qilinadi —
  // aks holda avtomatik yo'l bor ekan, uni chetlab o'tish TAQIQ.
  let creds: Creds | undefined = undefined;
  if ((order as any).cashdesk_id) {
    const c = await getCashdeskCredsById((order as any).cashdesk_id);
    if (c) creds = c;
  }
  const configured = creds ? true : await isCashdeskConfigured();

  if (manual) {
    if (configured) {
      // Kalitlar bor ekan — qo'lda rejimni chetlab o'tishga yo'l qo'ymaymiz.
      await admin.from("telegram_orders").update({ payout_status: "none" }).eq("id", orderId);
      return NextResponse.json({ error: "manual_not_allowed_configured" }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    await admin
      .from("telegram_orders")
      .update({
        payout_status: "success",
        payout_at: nowIso,
        payout_response: { manual: true, confirmed_by: check.userId },
      })
      .eq("id", orderId);
    await recordPayoutAttempt({ customerId, playerId, ok: true, error: null, ip: getClientIp(req.headers) });
    return NextResponse.json({ ok: true, payoutStatus: "success", manual: true });
  }

  if (!configured) {
    // Avtomatik yo'l yo'q — operatorga qo'lda rejimni tanlashi kerakligini bildiramiz.
    await admin.from("telegram_orders").update({ payout_status: "none" }).eq("id", orderId);
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }

  const outcome = await withTimeout(cashdeskPayout((order as any).account_id, (order as any).withdraw_code ?? "", creds), PAYOUT_TIMEOUT_MS);
  const nowIso = new Date().toISOString();

  // 1) JAVOB KELMADI (timeout) — 'pending'da QOLDIRAMIZ, avtomatik qayta
  // urinmaymiz. Operatorga "holatni tekshiring" ko'rsatiladi (client tomon).
  if (outcome === "timeout") {
    await admin.from("telegram_orders").update({ payout_response: { timeout: true }, payout_at: nowIso }).eq("id", orderId);
    return NextResponse.json({ ok: false, payoutStatus: "pending", error: "timeout_check_status" }, { status: 202 });
  }

  const result = outcome;

  if (result.ok) {
    await admin
      .from("telegram_orders")
      .update({ payout_status: "success", payout_at: nowIso, payout_response: result.data as any })
      .eq("id", orderId);
    await recordPayoutAttempt({ customerId, playerId, ok: true, error: null, ip: getClientIp(req.headers) });
    return NextResponse.json({ ok: true, payoutStatus: "success", summa: (result.data as any)?.summa ?? null });
  }

  await recordPayoutAttempt({ customerId, playerId, ok: false, error: result.error, ip: getClientIp(req.headers) });

  // Transport-darajasidagi ANIQ xato (imzo/so'rov rad etildi) — pul
  // ketmagani ANIQ, lekin kod bilan bog'liq emas (kalit/sozlama muammosi
  // bo'lishi mumkin) — 'failed', tez orada qayta urinish ma'nosiz.
  const TRANSPORT_ERRORS = ["signature_error_401", "signature_error_403", "request_failed", "not_configured"];
  if (TRANSPORT_ERRORS.includes(result.error)) {
    await admin
      .from("telegram_orders")
      .update({ payout_status: "failed", payout_at: nowIso, payout_response: { error: result.error } })
      .eq("id", orderId);
    return NextResponse.json({ ok: false, payoutStatus: "failed", error: result.error }, { status: 502 });
  }

  // W2.4: qolgan holat — API'ning o'zi "success:false" deb ANIQ javob
  // berdi (odatda noto'g'ri/eskirgan kod). Buyurtma BEKOR QILINMAYDI —
  // payout_status 'none'ga qaytadi, mijozdan yangi kod so'raladi.
  await admin
    .from("telegram_orders")
    .update({ payout_status: "none", payout_at: nowIso, payout_response: { error: result.error } })
    .eq("id", orderId);

  try {
    const { data: cust } = await admin.from("customers").select("telegram_id").eq("id", customerId).maybeSingle();
    if ((cust as any)?.telegram_id) {
      await sendTelegramMessage(
        (cust as any).telegram_id,
        "⚠️ Yechish kodi eskirgan yoki noto'g'ri. Iltimos, 1xbet'dan yangi kod oling va ilovada qayta kiriting."
      );
    }
  } catch {
    /* xabar best-effort */
  }

  return NextResponse.json({ ok: false, payoutStatus: "none", error: "code_invalid", needsNewCode: true }, { status: 409 });
}
