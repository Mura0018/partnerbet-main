import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTimezone, startOfDayInTimezone } from "@/lib/site/timezone";

const PAGE_SIZE = 100;
const ORDER_COLUMNS =
  "id, type, platform, account_id, amount, payment_method, withdraw_code, payout_details, recipient_name, receipt_path, status, operator_note, operator_id, claimed_by, payment_operator_id, received_account_number, received_holder_name, player_name, auto_processed, payout_done, handoff_open, sla_deadline, created_at, customers(phone, full_name)";

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
  let q = admin.from("telegram_orders").select(ORDER_COLUMNS, { count: "exact" });

  if (status !== "all") q = q.eq("status", status);

  if (onlyToday) {
    // Server UTC'da ishlaydi — "bugun" ni site_settings.timezone bo'yicha
    // hisoblaymiz (bu route ilgari OrdersTab.tsx'da brauzer-tomon edi).
    const todayStart = startOfDayInTimezone(new Date(), await getTimezone());
    q = q.gte("created_at", todayStart.toISOString());
  }

  if (onlyUnclaimed) {
    q = q.eq("status", "pending").is("claimed_by", null);
  }

  if (operatorId !== "all") {
    // "Egasi" ustuni statusga qarab boshqacha: pending -> claimed_by,
    // aks holda -> operator_id (mavjud client-tomon mantiq bilan bir xil).
    if (status === "pending") q = q.eq("claimed_by", operatorId);
    else if (status !== "all") q = q.eq("operator_id", operatorId);
    else q = q.or(`and(status.eq.pending,claimed_by.eq.${operatorId}),and(status.neq.pending,operator_id.eq.${operatorId})`);
  }

  if (search) {
    const { data: matchedCustomers } = await admin
      .from("customers")
      .select("id")
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(500);
    const matchedIds = (matchedCustomers ?? []).map((c: any) => c.id);
    const orParts = [`account_id.ilike.%${search}%`, `platform.ilike.%${search}%`, `player_name.ilike.%${search}%`];
    if (matchedIds.length) orParts.push(`customer_id.in.(${matchedIds.join(",")})`);
    q = q.or(orParts.join(","));
  }

  q = q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const { data, count } = await q;

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE });
}
