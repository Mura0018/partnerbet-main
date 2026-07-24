import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// G'olibни tasdiqlash (set) yoki olib tashlash (remove). Har segment+place
// bitta g'olib (unique). Admin QO'LDA tasdiqlaydi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const segment = body?.segment === "cash" ? "cash" : "online";
  const place = Number(body?.place);
  if (!action || !Number.isInteger(place) || place < 1 || place > 10) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "remove") {
    await admin.from("promo_winners").delete().eq("segment", segment).eq("place", place);
    return NextResponse.json({ ok: true });
  }

  // set — o'sha segment+place ni yangi mijozga biriktiradi (almashtiradi)
  const customerId = body?.customerId;
  if (!customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { error } = await admin.from("promo_winners").upsert(
    { customer_id: customerId, segment, place, confirmed_by: user.id, confirmed_at: new Date().toISOString() },
    { onConflict: "segment,place" }
  );
  if (error) return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
