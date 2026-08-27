import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Operator QR karta kodini (yoki qo'lда) skanerlaydi -> holatga qarab:
//  - blank      -> biriktirilmagan (mijozga bog'lash mumkin)
//  - assigned   -> mijoz + uning 1xBet ID lari (tasdiqlanmaganlar belgilangan)
//  - cancelled  -> bekor qilingan (+ sabab)
// MUHIM: mijozni ANIQLASH sovrin aksiyasiga BOG'LIQ EMAS — bu route
// site_settings 'promo' ni umuman o'qimaydi. Aksiya o'chiq bo'lsa ham skaner
// mijozni topadi. Faqat telegram_orders.manage (operator).
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
  const { data: cardRow } = await admin
    .from("promo_cards")
    .select("customer_id, card_code, status, claimed_at, assigned_at, cancelled_at, cancel_reason")
    .eq("card_code", code)
    .maybeSingle();

  if (!cardRow) return NextResponse.json({ ok: false, error: "not_found" });

  const status = (cardRow as any).status ?? "assigned";

  // BLANK — biriktirilmagan karta.
  if (status === "blank" || !(cardRow as any).customer_id) {
    return NextResponse.json({ ok: true, cardState: "blank", card: { code } });
  }

  // CANCELLED — bekor qilingan karta (+ sabab).
  if (status === "cancelled") {
    return NextResponse.json({
      ok: true,
      cardState: "cancelled",
      card: { code, cancel_reason: (cardRow as any).cancel_reason ?? null, cancelled_at: (cardRow as any).cancelled_at ?? null },
    });
  }

  // ASSIGNED — mijoz + ID ro'yxati + faollik.
  const customerId = (cardRow as any).customer_id as string;

  const { data: customer } = await admin
    .from("customers")
    .select("id, full_name, phone, created_at")
    .eq("id", customerId)
    .maybeSingle();

  // Mijozning 1xBet ID lari — asosiy birinchi, tasdiqlanmaganlar belgilangan.
  const { data: accountsRaw } = await admin
    .from("customer_bet_accounts")
    .select("player_id, player_name, is_primary, verified, source")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  // Faollik + so'nggi buyurtmalar.
  const { data: orders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, status, platform, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(15);
  const completed = (orders ?? []).filter((o: any) => o.status === "completed");
  const volume = completed.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

  // Skanerni qayd qilamiz (faqat biriktirilgan karta uchun — mijoz bor).
  await admin.from("promo_scans").insert({ customer_id: customerId, card_code: code, scanned_by: user.id });
  const { count: scanCount } = await admin.from("promo_scans").select("id", { count: "exact", head: true }).eq("customer_id", customerId);

  return NextResponse.json({
    ok: true,
    cardState: "assigned",
    customer: {
      id: (customer as any)?.id,
      full_name: (customer as any)?.full_name ?? null,
      phone: (customer as any)?.phone ?? "—",
      created_at: (customer as any)?.created_at ?? null,
    },
    accounts: (accountsRaw ?? []).map((a: any) => ({
      player_id: a.player_id,
      player_name: a.player_name ?? null,
      is_primary: !!a.is_primary,
      verified: !!a.verified,
    })),
    card: { code, assigned_at: (cardRow as any).assigned_at ?? (cardRow as any).claimed_at ?? null },
    activity: { volume, orders_count: completed.length },
    orders: orders ?? [],
    scanCount: scanCount ?? 1,
  });
}
