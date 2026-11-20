import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { claimThreadIfUnclaimed } from "@/lib/support/ownership";

// Murojaatni o'z zimmasiga olish (support-archive naqshi). Ilgari brauzer
// telegram_support_threads'ga to'g'ridan-to'g'ri upsert qilardi (claimed_by
// mijoz tomonidan berilardi). 0103 dan keyin brauzer bu jadvalga yoza olmaydi —
// yozish faqat shu yerda, service role orqali.
//
//  body: { customerId: string, takeOver?: boolean }
//   - takeOver=false (thread ochilganda avto-olish): faqat hech kim olmagan
//     bo'lsa oladi; band bo'lsa { claimed: false } (oldingi xulq bilan bir xil).
//   - takeOver=true ("O'zimga olish" tugmasi): boshqa operatordan oladi.
//  claimed_by HAR DOIM serverdagi user.id — mijoz qiymati qabul qilinmaydi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "string" ? body.customerId : "";
  const takeOver = body?.takeOver === true;
  if (!customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();

  // 3-band: avto-olish ATOMIK (shartli UPDATE, `claimed_by is null`) — avval
  // "tekshir, keyin yoz" edi va ikki operator bir vaqtda olishi mumkin edi.
  if (!takeOver) {
    const claimed = await claimThreadIfUnclaimed(admin, customerId, user.id);
    return NextResponse.json({ ok: true, claimed });
  }

  const { error } = await admin
    .from("telegram_support_threads")
    .upsert(
      { customer_id: customerId, claimed_by: user.id, claimed_at: new Date().toISOString() },
      { onConflict: "customer_id" }
    );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, claimed: true });
}
