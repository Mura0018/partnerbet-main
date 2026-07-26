import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

// W1.4: full_name bo'sh mijozlar (eski, ro'yxatdan o'tishda ism
// so'ralmagan davr) ism-solishtiruv tekshiruvidan o'ta olmaydi — bu
// endpoint ularга BIR MARTA ism kiritish imkonini beradi. Faqat
// full_name HALI BO'SH bo'lsa yozadi (mavjud ismni almashtira olmaydi —
// buni faqat operator, name-mismatch tasdiqi orqali qila oladi).
export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`set-full-name:${ip}`, 60, 5);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, fullName } = body ?? {};
  if (!initData || !fullName || !String(fullName).trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("customers")
    .update({ full_name: String(fullName).trim().slice(0, 150) })
    .eq("id", cc.customer.id)
    .is("full_name", null);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}
