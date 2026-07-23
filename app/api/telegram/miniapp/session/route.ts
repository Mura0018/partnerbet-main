import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";

export async function POST(req: NextRequest) {
  const { initData } = await req.json().catch(() => ({ initData: null }));
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  // Kirish qoidasi: begona mijoz (denied) yoki ro'yxatdan o'tmagan => registered:false.
  // (Hamkor app'iga faqat o'z mijozi kiradi; rad etish jim.)
  if (cc.denied || !cc.customer) {
    return NextResponse.json({ registered: false, partnerId: cc.partnerId });
  }
  return NextResponse.json({
    registered: true,
    customer: { id: cc.customer.id, full_name: cc.customer.full_name, phone: cc.customer.phone },
    partnerId: cc.partnerId,
  });
}
