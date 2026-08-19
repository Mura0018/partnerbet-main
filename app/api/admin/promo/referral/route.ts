import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// MURAWIN promo kodi boshqaruvi — site_settings 'promo_referral' kaliti.
// Ruxsat: promo.manage (aksiya sozlamasi bilan bir xil).
async function guard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, user: null };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return { ok: false as const, status: 403, user: null };
  return { ok: true as const, status: 200, user };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("value").eq("key", "promo_referral").maybeSingle();
  const v = (data?.value as any) ?? {};
  return NextResponse.json({
    referral: {
      enabled: v.enabled === true,
      code: String(v.code ?? ""),
      description: String(v.description ?? ""),
      link: String(v.link ?? ""),
      expires_at: v.expires_at ?? null,
    },
  });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const next = {
    enabled: body.enabled === true,
    code: String(body.code ?? "").trim().slice(0, 60),
    description: String(body.description ?? "").trim().slice(0, 200),
    link: String(body.link ?? "").trim().slice(0, 1000),
    expires_at: body.expires_at ? String(body.expires_at) : null,
  };

  const admin = createAdminClient();
  const { error } = await admin.from("site_settings").upsert(
    { key: "promo_referral", value: next, updated_by: g.user!.id, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, referral: next });
}
