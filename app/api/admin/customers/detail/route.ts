import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Bitta mijoz + buyurtma tarixi. Parol/maxfiy maydonlar qaytarilmaydi.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "customers.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: c } = await admin
    .from("customers")
    .select("id, full_name, phone, created_at, partner_id, telegram_id, owner_operator_id, name_override_by, name_override_at, name_override_reason")
    .eq("id", id)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // W1.4: hali hal qilinmagan ism-nomuvofiqlik (bo'lsa — eng so'nggisi).
  const { data: pendingMismatch } = await admin
    .from("name_mismatch_flags")
    .select("id, registered_name, player_name, platform, account_id, created_at")
    .eq("customer_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nameOverrideByName: string | null = null;
  if ((c as any).name_override_by) {
    const { data: op } = await admin.from("profiles").select("display_name, full_name").eq("id", (c as any).name_override_by).maybeSingle();
    nameOverrideByName = (op as any)?.display_name || (op as any)?.full_name || null;
  }

  let partnerName: string | null = null;
  if ((c as any).partner_id) {
    const { data: p } = await admin.from("partners").select("name").eq("id", (c as any).partner_id).maybeSingle();
    partnerName = (p?.name as string) ?? null;
  }

  // 2-BOSQICH: mijoz egasi (owner operator) nomi.
  let ownerName: string | null = null;
  if ((c as any).owner_operator_id) {
    const { data: op } = await admin
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", (c as any).owner_operator_id)
      .maybeSingle();
    ownerName = (op as any)?.display_name || (op as any)?.full_name || null;
  }

  const { data: orders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, status, platform, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({
    customer: {
      id: (c as any).id,
      full_name: (c as any).full_name,
      phone: (c as any).phone,
      created_at: (c as any).created_at,
      telegram_id: (c as any).telegram_id,
      partnerName,
      ownerName,
      nameMismatch: pendingMismatch ?? null,
      nameOverride: (c as any).name_override_by
        ? { by: nameOverrideByName, at: (c as any).name_override_at, reason: (c as any).name_override_reason }
        : null,
    },
    orders: (orders as any[]) ?? [],
  });
}
