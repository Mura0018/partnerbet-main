import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTimezone, startOfDayInTimezone } from "@/lib/site/timezone";

const PAGE_SIZE = 100;
const BASE_ORDER_COLUMNS =
  "id, type, platform, account_id, amount, payment_method, withdraw_code, payout_details, recipient_name, receipt_path, status, operator_note, operator_id, claimed_by, payment_operator_id, received_account_number, received_holder_name, player_name, auto_processed, handoff_open, sla_deadline, created_at, customers(phone, full_name)";
// W2: payout_status/payout_attempt_count — migratsiya (0092) hali
// qo'yilmagan bo'lishi mumkin. Shu ikkalasi bilan so'rov xato bersa,
// pastda BASE_ORDER_COLUMNS (bularsiz) bilan qayta uriniladi — aks holda
// butun ro'yxat (barcha buyurtma turlari) BO'SH ko'rinib qolardi.
const ORDER_COLUMNS = `${BASE_ORDER_COLUMNS}, payout_status, payout_attempt_count`;

// Buyurtmalar ro'yxati — qidiruv/filtr server tomonda (#16). Ilgari
// OrdersTab.tsx .limit(200) bilan olib, qidiruv/operator/bugun/olinmagan
// filtrlarini FAQAT shu 200 qator ustida qilardi — 200 tadan eski buyurtma
// hech qanday filtr bilan topilmasdi.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "pending"; // pending | completed | rejected | all
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10) || 0);
  const onlyToday = sp.get("onlyToday") === "1";
  const onlyUnclaimed = sp.get("onlyUnclaimed") === "1";
  const operatorId = sp.get("operatorId") ?? "all";
  // PostgREST or() sintaksisini buzmaslik/injection uchun tozalaymiz (customers/route.ts bilan bir xil).
  const search = (sp.get("search") ?? "").trim().replace(/[,()*%]/g, "").slice(0, 60);

  const admin = createAdminClient();

  // search filtri uchun mijoz ID'lari — ustunlar ro'yxatidan mustaqil,
  // shuning uchun bir marta hisoblanadi (ikkala urinishda ham qayta ishlatiladi).
  let searchOrParts: string[] | null = null;
  if (search) {
    const { data: matchedCustomers } = await admin
      .from("customers")
      .select("id")
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(500);
    const matchedIds = (matchedCustomers ?? []).map((c: any) => c.id);
    const orParts = [`account_id.ilike.%${search}%`, `platform.ilike.%${search}%`, `player_name.ilike.%${search}%`];
    if (matchedIds.length) orParts.push(`customer_id.in.(${matchedIds.join(",")})`);
    searchOrParts = orParts;
  }

  const runQuery = (columns: string) => {
    let q = admin.from("telegram_orders").select(columns, { count: "exact" });
    if (status !== "all") q = q.eq("status", status);
    if (onlyUnclaimed) q = q.eq("status", "pending").is("claimed_by", null);
    if (operatorId !== "all") {
      // "Egasi" ustuni statusga qarab boshqacha: pending -> claimed_by,
      // aks holda -> operator_id (mavjud client-tomon mantiq bilan bir xil).
      if (status === "pending") q = q.eq("claimed_by", operatorId);
      else if (status !== "all") q = q.eq("operator_id", operatorId);
      else q = q.or(`and(status.eq.pending,claimed_by.eq.${operatorId}),and(status.neq.pending,operator_id.eq.${operatorId})`);
    }
    if (searchOrParts) q = q.or(searchOrParts.join(","));
    return q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  };

  // onlyToday — "bugun" hisoblash uchun avval timezone kerak, shuning
  // uchun runQuery chaqirilishidan oldin uni ham qo'shib qo'yamiz.
  const todayStart = onlyToday ? startOfDayInTimezone(new Date(), await getTimezone()) : null;
  const withToday = (q: ReturnType<typeof runQuery>) => (todayStart ? q.gte("created_at", todayStart.toISOString()) : q);

  let { data, count, error } = await withToday(runQuery(ORDER_COLUMNS));
  if (error) {
    // payout_status/payout_attempt_count ustunlari hali yo'q (migratsiya
    // 0092 qo'yilmagan) — eski qisqa ustun ro'yxati bilan qayta so'raymiz.
    ({ data, count, error } = await withToday(runQuery(BASE_ORDER_COLUMNS)));
  }

  const orders = (data ?? []).map((o: any) => ({
    ...o,
    payout_status: o.payout_status ?? "none",
    payout_attempt_count: o.payout_attempt_count ?? 0,
  }));

  return NextResponse.json({ orders, total: count ?? 0, page, pageSize: PAGE_SIZE });
}
