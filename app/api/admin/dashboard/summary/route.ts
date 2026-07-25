import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getTimezone, startOfDayInTimezone } from "@/lib/site/timezone";

type Period = "today" | "7d" | "30d" | "all";

// app/admin/dashboard/page.tsx dagi periodStart() bilan bir xil mantiq —
// faqat "today" holati boshqacha: bu route serverda (UTC) ishlaydi, shuning
// uchun site_settings.timezone bo'yicha hisoblanadi (klientdagi periodStart
// esa brauzer vaqtidan foydalanadi — u yerga tegilmadi).
function periodStart(p: Period, tz: string): string | null {
  if (p === "all") return null;
  const now = new Date();
  if (p === "today") return startOfDayInTimezone(now, tz).toISOString();
  return new Date(now.getTime() - (p === "7d" ? 7 : 30) * 86400000).toISOString();
}

// Dashboard moliyaviy jamlanma — betcore_financial_report RPC'dan (bir xil
// manba /admin/reports bilan). Ilgari bu klientda .limit(20000) bilan
// hisoblanardi va katta davrda son jim kamayardi (#11, #12).
//
// Ruxsat: telegram_orders.manage — hozirgi UI gate bilan bir xil
// (super_admin + admin + operator). Operator platforma miqyosidagi
// moliyaviy jamlanmani ko'rishi kerakmi — bu alohida mahsulot qarori,
// hozir hal qilinmaydi; telegram_orders RLS ("telegram_orders.manage
// full access") allaqachon shu rolga BARCHA qatorni ochadi, shuning
// uchun bu route maxfiylikda hech narsani o'zgartirmaydi.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const period = (sp.get("period") as Period) ?? "today";
  const start = periodStart(period, await getTimezone());
  const nowIso = new Date().toISOString();

  const admin = createAdminClient();

  const [{ data: report }, pend, open, cust] = await Promise.all([
    admin.rpc("betcore_financial_report", { p_start: start ?? "1970-01-01T00:00:00Z", p_end: nowIso }),
    // Snapshot — davrga bog'liq emas, "hozir kutilayotgan" (mavjud xulq saqlandi).
    admin.from("telegram_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("telegram_support_threads").select("customer_id", { count: "exact", head: true }).eq("is_archived", false),
    (() => {
      let q = admin.from("customers").select("id", { count: "exact", head: true });
      if (start) q = q.gte("created_at", start);
      return q;
    })(),
  ]);

  const r = (report as any) ?? {};

  // Operator faoliyat jadvali: completed/volume — RPC'ning by_operator'idan
  // (allaqachon to'g'ri, kesilmagan). "Javoblar" support jadvalidan — bu
  // moliyaviy hisobot doirasidan tashqarida, shuning uchun RPC'ga
  // qo'shilmadi (alohida so'rov). Xodimlar soni kichik bo'lgani uchun
  // har xodim uchun alohida COUNT so'rov (limit(30000) o'rniga) ishlaydi —
  // xodimlar soni sezilarli oshsa, group-by RPC'ga o'tish kerak bo'ladi.
  const { data: permission } = await admin.from("permissions").select("id").eq("key", "telegram_orders.manage").maybeSingle();
  let staffIds: string[] = [];
  let nameById: Record<string, string> = {};
  if (permission) {
    const { data: rolePermissions } = await admin.from("role_permissions").select("role_id").eq("permission_id", permission.id);
    const roleIds = (rolePermissions ?? []).map((rp: any) => rp.role_id);
    if (roleIds.length) {
      const { data: staff } = await admin.from("profiles").select("id, display_name, full_name").in("role_id", roleIds).eq("is_active", true);
      for (const s of (staff ?? []) as any[]) { staffIds.push(s.id); nameById[s.id] = s.display_name || s.full_name || "—"; }
    }
  }

  const repliesById: Record<string, number> = {};
  if (staffIds.length) {
    const counts = await Promise.all(staffIds.map((id) => {
      let q = admin.from("telegram_support_messages").select("id", { count: "exact", head: true }).eq("sender", "operator").eq("operator_id", id);
      if (start) q = q.gte("created_at", start);
      return q;
    }));
    staffIds.forEach((id, i) => { repliesById[id] = counts[i].count ?? 0; });
  }

  const byOperator = (r.by_operator ?? []) as { operator_id: string; cnt: number; vol: number }[];
  const opMap = new Map<string, { completed: number; volume: number }>();
  for (const o of byOperator) opMap.set(o.operator_id, { completed: Number(o.cnt), volume: Number(o.vol) });

  const staffRows = Array.from(new Set([...opMap.keys(), ...Object.keys(repliesById).filter((id) => repliesById[id] > 0)]))
    .map((id) => ({
      id,
      name: nameById[id] ?? "—",
      completed: opMap.get(id)?.completed ?? 0,
      volume: opMap.get(id)?.volume ?? 0,
      replies: repliesById[id] ?? 0,
    }))
    .sort((a, b) => b.completed - a.completed || b.replies - a.replies);

  return NextResponse.json({
    pending: pend.count ?? 0,
    openSupport: open.count ?? 0,
    customers: cust.count ?? 0,
    completed: Number(r.completed_count ?? 0),
    rejected: Number(r.rejected_count ?? 0),
    volume: Number(r.topup_volume ?? 0) + Number(r.withdraw_volume ?? 0),
    topup: Number(r.topup_count ?? 0),
    withdraw: Number(r.withdraw_count ?? 0),
    staff: staffRows,
  });
}
