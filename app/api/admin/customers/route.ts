import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 50;

async function requireCustomersManage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "customers.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

// Mijozlar ro'yxati (sahifalash, qidiruv, hamkor filtri). Maxfiy maydonlar
// (password_hash) HECH QACHON qaytarilmaydi.
export async function GET(req: NextRequest) {
  const check = await requireCustomersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const sp = req.nextUrl.searchParams;
  // PostgREST or() sintaksisini buzmaslik/injection uchun tozalaymiz.
  const search = (sp.get("search") ?? "").trim().replace(/[,()*%]/g, "").slice(0, 60);
  const partnerId = sp.get("partnerId") ?? "all";
  const showHidden = sp.get("hidden") === "1"; // standart: yashiringanlar KO'RINMAYDI
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10) || 0);

  const admin = createAdminClient();
  let q = admin.from("customers").select("id, full_name, phone, created_at, partner_id", { count: "exact" });
  q = q.eq("is_hidden", showHidden);
  if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  if (partnerId === "platform") q = q.is("partner_id", null);
  else if (partnerId !== "all") q = q.eq("partner_id", partnerId);
  q = q.order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const { data: customers, count } = await q;

  const list = (customers as any[]) ?? [];

  // Hamkor nomlari
  const pids = Array.from(new Set(list.map((c) => c.partner_id).filter(Boolean)));
  const nameById: Record<string, string> = {};
  if (pids.length) {
    const { data: partners } = await admin.from("partners").select("id, name").in("id", pids);
    for (const p of (partners ?? []) as any[]) nameById[p.id] = p.name;
  }

  // Buyurtma soni (faqat shu sahifadagi mijozlar uchun)
  const ids = list.map((c) => c.id);
  const orderCount: Record<string, number> = {};
  if (ids.length) {
    const { data: ords } = await admin.from("telegram_orders").select("customer_id").in("customer_id", ids).limit(20000);
    for (const o of (ords ?? []) as any[]) orderCount[o.customer_id] = (orderCount[o.customer_id] ?? 0) + 1;
  }

  // Filtr uchun barcha hamkorlar (kichik ro'yxat)
  const { data: allPartners } = await admin.from("partners").select("id, name").order("name");

  return NextResponse.json({
    customers: list.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      created_at: c.created_at,
      partnerName: c.partner_id ? (nameById[c.partner_id] ?? "—") : null,
      orderCount: orderCount[c.id] ?? 0,
    })),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    partners: (allPartners as any[]) ?? [],
  });
}
