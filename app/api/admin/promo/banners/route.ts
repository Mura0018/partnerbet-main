import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

async function guard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const admin = createAdminClient();
  const { data } = await admin.from("promo_banners").select("*").order("sort", { ascending: true }).order("created_at", { ascending: false });
  return NextResponse.json({ banners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const row = {
    title: b.title ? String(b.title).slice(0, 120) : null,
    subtitle: b.subtitle ? String(b.subtitle).slice(0, 200) : null,
    image_url: b.image_url ? String(b.image_url).slice(0, 1000) : null,
    link_url: b.link_url ? String(b.link_url).slice(0, 1000) : null,
    is_active: b.is_active === false ? false : true,
    sort: Number.isFinite(Number(b.sort)) ? Number(b.sort) : 0,
  };

  const admin = createAdminClient();
  if (b.id) {
    const { error } = await admin.from("promo_banners").update(row).eq("id", b.id);
    if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await admin.from("promo_banners").insert(row).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("promo_banners").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
