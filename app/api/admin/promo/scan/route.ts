import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// B7 (C): operator sovrin karta kodini (QR yoki qo'lда) skanerlaydi ->
// mijozni topadi, faollik + so'nggi buyurtmalarни ko'rsatadi, SKANER qayd
// etiladi. Faqat telegram_orders.manage (operator).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: cardRow } = await admin.from("promo_cards").select("customer_id, card_code, claimed_at").eq("card_code", code).maybeSingle();
  if (!cardRow) return NextResponse.json({ ok: false, error: "not_found" });

  const customerId = (cardRow as any).customer_id as string;

  const { data: customer } = await admin
    .from("customers")
    .select("id, full_name, phone, created_at, telegram_id")
    .eq("id", customerId)
    .maybeSingle();

  // Faollik + so'nggi buyurtmalar
  const { data: orders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, status, platform, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(15);
  const completed = (orders ?? []).filter((o: any) => o.status === "completed");
  const volume = completed.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

  // Skanerni qayd qilamiz
  await admin.from("promo_scans").insert({ customer_id: customerId, card_code: code, scanned_by: user.id });
  const { count: scanCount } = await admin.from("promo_scans").select("id", { count: "exact", head: true }).eq("customer_id", customerId);

  return NextResponse.json({
    ok: true,
    customer: {
      id: (customer as any)?.id,
      full_name: (customer as any)?.full_name ?? null,
      phone: (customer as any)?.phone ?? "—",
      created_at: (customer as any)?.created_at ?? null,
    },
    card: { code, claimed_at: (cardRow as any).claimed_at },
    activity: { volume, orders_count: completed.length },
    orders: orders ?? [],
    scanCount: scanCount ?? 1,
  });
}
