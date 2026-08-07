import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { recordRequisiteReveal } from "@/lib/payments/pickRequisite";

// Without this, Next.js can statically render this GET handler once at
// build time (no Request/cookies/headers usage triggers that) and keep
// serving that frozen snapshot in production forever — which is exactly
// why a payment method added after deploy wasn't showing up.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// W1.1: bu endpoint ILGARI mustaqil edi — mijoz buyurtma yaratmasdan turib
// istalgan kartani, istalgancha marta ko'rishi mumkin edi (audit W0, 60/60s
// rate limit bilan ham suiiste'mol qilinishi mumkin edi). Rekvizit tanlash
// endi FAQAT /api/telegram/miniapp/orders (buyurtma yaratishda) sodir
// bo'ladi. Bu endpoint endi shunchaki — MAVJUD, o'ziga tegishli, HALI
// pending bo'lgan topup buyurtmaning ALLAQACHON tanlangan rekvizitini
// qayta ko'rsatadi (masalan mijoz ilovani yopib qayta ochsa). Yangi
// karta TANLAMAYDI, faqat saqlanganini o'qiydi — va har o'qishni ham
// requisite_reveals'ga qayd etadi.
export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!initData || !orderId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const customer = cc.customer;

  // W1.1: 60/60s -> 10/60s. Endpoint endi bitta MA'LUM buyurtmani qayta
  // ko'rsatadi, xolos — bunchalik yuqori chastotaga ehtiyoj yo'q.
  const { allowed } = await checkAndRecordRateLimit(`payment-info:${customer.id}`, 60, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("telegram_orders")
    .select("id, customer_id, type, status, payment_method, payment_operator_id, received_account_number, received_holder_name, partner_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || (order as any).customer_id !== customer.id || (order as any).type !== "topup") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Yakunlangan/rad etilgan/eskirgan buyurtmada rekvizit QAYTARILMAYDI.
  if ((order as any).status !== "pending") {
    return NextResponse.json({ error: "order_not_pending" }, { status: 409 });
  }
  if (!(order as any).received_account_number) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await recordRequisiteReveal({
      customerId: customer.id,
      orderId: (order as any).id,
      methodType: (order as any).payment_method,
      picked: {
        accountNumber: (order as any).received_account_number,
        holderName: (order as any).received_holder_name,
        operatorId: (order as any).payment_operator_id,
        partnerId: (order as any).payment_operator_id ? null : (order as any).partner_id,
        methodRowId: "",
        isPartner: !(order as any).payment_operator_id,
      },
      ip: getClientIp(req.headers),
    });
  } catch {
    /* audit best-effort — ko'rsatishni bloklamaydi */
  }

  return NextResponse.json(
    {
      accountNumber: (order as any).received_account_number,
      holderName: (order as any).received_holder_name ?? "",
      methodType: (order as any).payment_method,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
