import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Aksiya sozlamasi: yoq/och + muddat (start/end) + naqd koeffitsiyenti + sovrinlar.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("site_settings").select("value").eq("key", "promo").maybeSingle();
  const cur = (existing?.value as any) ?? {};

  const mult = Number(body.cash_multiplier);
  const next = {
    ...cur,
    enabled: typeof body.enabled === "boolean" ? body.enabled : (cur.enabled ?? false),
    start: body.start || null,
    end: body.end || null,
    cash_multiplier: Number.isFinite(mult) && mult > 0 ? mult : 1.5,
    prizes: Array.isArray(body.prizes) ? body.prizes.map((x: any) => String(x).slice(0, 200)).filter(Boolean).slice(0, 10) : (cur.prizes ?? []),
  };

  const { error } = await admin.from("site_settings").upsert(
    { key: "promo", value: next, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, settings: next });
}
