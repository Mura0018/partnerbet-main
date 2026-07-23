import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret } from "@/lib/security/encryption";
import { listCashdesks, CASHDESK_PUBLIC_COLS } from "@/lib/cashdesk/store";

// Kassalar ro'yxati + egasi bo'lishi mumkin bo'lgan operatorlar. Maxfiy
// kalitlar (pass_enc/hash_enc) HECH QACHON qaytmaydi (listCashdesks public
// ustunlar). Balans alohida endpointdan (non-blocking) olinadi.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const cashdesks = await listCashdesks();
  const { data: operators } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return NextResponse.json({ cashdesks, operators: operators ?? [] });
}

// Yangi kassa. pass va hash SHIFRLANIB saqlanadi (encryptSecret).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const cashdeskId = String(body.cashdesk_id ?? "").trim();
  const login = String(body.login ?? "").trim();
  const pass = String(body.pass ?? "").trim();
  const hash = String(body.hash ?? "").trim();
  if (!name || !cashdeskId || !login || !pass || !hash) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const threshold =
    body.low_balance_threshold === null || body.low_balance_threshold === undefined || body.low_balance_threshold === ""
      ? null
      : Number(body.low_balance_threshold);
  if (threshold !== null && !Number.isFinite(threshold)) {
    return NextResponse.json({ error: "invalid_threshold" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cashdesks")
    .insert({
      name,
      cashdesk_id: cashdeskId,
      login,
      pass_enc: encryptSecret(pass),
      hash_enc: encryptSecret(hash),
      owner_operator_id: body.owner_operator_id || null,
      is_active: body.is_active === false ? false : true,
      region: body.region ? String(body.region).trim() : null,
      low_balance_threshold: threshold,
      note: body.note ? String(body.note).trim() : null,
    })
    .select(CASHDESK_PUBLIC_COLS)
    .maybeSingle();

  if (error) {
    // cashdesk_id unique — bir xil KRM raqami takror bo'lsa
    if ((error as any).code === "23505") return NextResponse.json({ error: "duplicate_cashdesk_id" }, { status: 409 });
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ cashdesk: data });
}
