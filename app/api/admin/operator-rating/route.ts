import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 7-BOSQICH: super_admin — operatorlar reytingi (tartiblangan) + reyting
// hodisalari + alertlar tarixi.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "operators.oversight" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: operators } = await admin
    .from("profiles")
    .select("id, display_name, full_name, rating, is_online, is_busy")
    .eq("is_active", true)
    .order("rating", { ascending: true }); // eng past (muammoli) yuqorида
  const nameById: Record<string, string> = {};
  for (const o of (operators ?? []) as any[]) nameById[o.id] = o.display_name || o.full_name || "Operator";

  const { data: events } = await admin
    .from("operator_rating_events")
    .select("id, operator_id, order_id, delta, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: alerts } = await admin
    .from("operator_alerts")
    .select("id, operator_id, order_id, level, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const withName = (rows: any[] | null) =>
    (rows ?? []).map((r) => ({ ...r, operator_name: r.operator_id ? nameById[r.operator_id] ?? "Operator" : "—" }));

  return NextResponse.json({
    operators: (operators ?? []).map((o: any) => ({
      id: o.id,
      name: nameById[o.id],
      rating: o.rating ?? 0,
      is_online: o.is_online,
      is_busy: o.is_busy,
    })),
    events: withName(events),
    alerts: withName(alerts),
  });
}
