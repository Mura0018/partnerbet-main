import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// B7 (D): aksiya sozlamasi + davr/segment reytingi (naqd=skanerlangan) +
// tasdiqlangan g'oliblar. Faqat promo.manage (super_admin).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: pRow } = await admin.from("site_settings").select("value").eq("key", "promo").maybeSingle();
  const settings = (pRow?.value as any) ?? {};
  const start = settings.start || null;
  const end = settings.end || null;

  const { data: ranking } = await admin.rpc("promo_activity_ranking_v2", { p_start: start, p_end: end });

  const { data: winners } = await admin
    .from("promo_winners")
    .select("id, customer_id, segment, place, note, confirmed_at, customers(full_name, phone)")
    .order("segment", { ascending: true })
    .order("place", { ascending: true });

  return NextResponse.json({ settings, ranking: ranking ?? [], winners: winners ?? [] });
}
