import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret } from "@/lib/security/encryption";
import { CASHDESK_PUBLIC_COLS } from "@/lib/cashdesk/store";

// Kassani tahrirlash. pass/hash faqat YANGI qiymat berilsagina qayta
// shifrlanadi (bo'sh -> tegilmaydi). Maxfiy kalitlar qaytmaydi.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.cashdesk_id !== undefined) patch.cashdesk_id = String(body.cashdesk_id).trim();
  if (body.login !== undefined) patch.login = String(body.login).trim();
  if (body.owner_operator_id !== undefined) patch.owner_operator_id = body.owner_operator_id || null;
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;
  if (body.region !== undefined) patch.region = body.region ? String(body.region).trim() : null;
  if (body.note !== undefined) patch.note = body.note ? String(body.note).trim() : null;
  if (body.low_balance_threshold !== undefined) {
    const t = body.low_balance_threshold === null || body.low_balance_threshold === "" ? null : Number(body.low_balance_threshold);
    if (t !== null && !Number.isFinite(t)) return NextResponse.json({ error: "invalid_threshold" }, { status: 400 });
    patch.low_balance_threshold = t;
  }
  // Faqat bo'sh bo'lmagan yangi maxfiy qiymat berilsa qayta shifrlanadi.
  if (body.pass !== undefined && String(body.pass).trim() !== "") patch.pass_enc = encryptSecret(String(body.pass).trim());
  if (body.hash !== undefined && String(body.hash).trim() !== "") patch.hash_enc = encryptSecret(String(body.hash).trim());

  const admin = createAdminClient();
  const { data, error } = await admin.from("cashdesks").update(patch).eq("id", id).select(CASHDESK_PUBLIC_COLS).maybeSingle();
  if (error) {
    if ((error as any).code === "23505") return NextResponse.json({ error: "duplicate_cashdesk_id" }, { status: 409 });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ cashdesk: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { error } = await admin.from("cashdesks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
