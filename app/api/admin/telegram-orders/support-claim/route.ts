import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { claimThreadIfUnclaimed, SUPPORT_OVERRIDE_PERMISSION } from "@/lib/support/ownership";
import { serverT } from "@/lib/i18n/server";

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

  // 2-band — "O'zimga olish" qoidasi:
  //  - egasi YO'Q suhbat: har qanday operator (atomik, avto-olish bilan bir xil);
  //  - egasi BOR suhbat: faqat rahbar (telegram_operators.manage). Avval bu
  //    tugma hammaga ochiq edi va javobdagi egalik tekshiruvini chetlab o'tardi.
  if (await claimThreadIfUnclaimed(admin, customerId, user.id)) {
    return NextResponse.json({ ok: true, claimed: true });
  }
  const { data: thr } = await admin
    .from("telegram_support_threads")
    .select("claimed_by")
    .eq("customer_id", customerId)
    .maybeSingle();
  const prevOwner = (thr as { claimed_by: string | null } | null)?.claimed_by ?? null;
  if (!prevOwner || prevOwner === user.id) return NextResponse.json({ ok: true, claimed: true });

  const { data: canOverride } = await supabase.rpc("has_permission", { perm_key: SUPPORT_OVERRIDE_PERMISSION });
  if (!canOverride) return NextResponse.json({ error: "takeover_forbidden" }, { status: 403 });

  // Atomik: faqat egasi hali o'sha (prevOwner) bo'lsa o'zgaradi — parallel
  // o'zgarish bo'lsa ustidan yozilmaydi.
  const nowIso = new Date().toISOString();
  const { data: moved, error } = await admin
    .from("telegram_support_threads")
    .update({ claimed_by: user.id, claimed_at: nowIso })
    .eq("customer_id", customerId)
    .eq("claimed_by", prevOwner)
    .select("customer_id");
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!moved || moved.length === 0) return NextResponse.json({ error: "claim_changed" }, { status: 409 });

  // Jamoa chatiga qayd (takeover/route.ts dagi handoff naqshi): kim, kimdan;
  // vaqt — xabarning o'z created_at'i. Best-effort.
  try {
    const [{ data: me }, { data: prev }, { data: cust }] = await Promise.all([
      admin.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("display_name, full_name").eq("id", prevOwner).maybeSingle(),
      admin.from("customers").select("full_name, phone").eq("id", customerId).maybeSingle(),
    ]);
    const nm = (p: any) => p?.display_name || p?.full_name || "Operator";
    await admin.from("team_chat_messages").insert({
      sender_id: user.id,
      is_system: true,
      event_type: "handoff",
      message: serverT("uz", "spb.takeoverLog", {
        manager: nm(me),
        prev: nm(prev),
        customer: (cust as any)?.full_name || (cust as any)?.phone || "—",
      }),
    });
  } catch {
    /* qayd best-effort */
  }

  return NextResponse.json({ ok: true, claimed: true });
}
