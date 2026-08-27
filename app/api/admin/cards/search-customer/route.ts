import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Blank kartani biriktirish uchun mijoz qidirish: telefon / 1xBet ID / ism.
// ENG KAM 3 belgi — aks holda bo'sh so'rov butun ro'yxatni tortmasin.
// Pul harakati yo'q. telegram_orders.manage.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // PostgREST or() sintaksisi/injection uchun tozalash (customers/route.ts naqshi).
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[,()*%]/g, "").slice(0, 60);
  if (q.length < 3) return NextResponse.json({ customers: [], tooShort: true });

  const admin = createAdminClient();

  // Telefon / ism bo'yicha + 1xBet ID (customer_bet_accounts) bo'yicha.
  const [{ data: byCustomer }, { data: byAccount }] = await Promise.all([
    admin.from("customers").select("id").or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(20),
    admin.from("customer_bet_accounts").select("customer_id").ilike("player_id", `%${q}%`).limit(50),
  ]);

  const ids = new Set<string>();
  (byCustomer ?? []).forEach((c: any) => ids.add(c.id));
  (byAccount ?? []).forEach((a: any) => a.customer_id && ids.add(a.customer_id));
  if (ids.size === 0) return NextResponse.json({ customers: [] });

  const idArr = [...ids].slice(0, 20);
  const [{ data: customers }, { data: accounts }] = await Promise.all([
    admin.from("customers").select("id, full_name, phone").in("id", idArr),
    admin.from("customer_bet_accounts").select("customer_id, player_id, is_primary, verified").in("customer_id", idArr).order("is_primary", { ascending: false }),
  ]);

  const accByCust: Record<string, any[]> = {};
  (accounts ?? []).forEach((a: any) => {
    (accByCust[a.customer_id] ??= []).push({ player_id: a.player_id, is_primary: !!a.is_primary, verified: !!a.verified });
  });

  return NextResponse.json({
    customers: (customers ?? []).map((c: any) => ({
      id: c.id,
      full_name: c.full_name ?? null,
      phone: c.phone ?? "—",
      accounts: accByCust[c.id] ?? [],
    })),
  });
}
