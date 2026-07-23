import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const { initData } = await req.json().catch(() => ({ initData: null }));
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  // Hamkor app bo'lsa — uning temasini olamiz (registratsiyadan oldin ham qo'llansin).
  let theme = "classic";
  if (cc.partnerId) {
    const admin = createAdminClient();
    const { data: p } = await admin.from("partners").select("theme_key").eq("id", cc.partnerId).maybeSingle();
    theme = (p?.theme_key as string) || "classic";
  }

  // Kirish qoidasi: begona mijoz (denied) yoki ro'yxatdan o'tmagan => registered:false.
  // (Hamkor app'iga faqat o'z mijozi kiradi; rad etish jim.)
  if (cc.denied || !cc.customer) {
    return NextResponse.json({ registered: false, denied: cc.denied, partnerId: cc.partnerId, theme });
  }
  return NextResponse.json({
    registered: true,
    customer: { id: cc.customer.id, full_name: cc.customer.full_name, phone: cc.customer.phone },
    partnerId: cc.partnerId,
    theme,
  });
}
