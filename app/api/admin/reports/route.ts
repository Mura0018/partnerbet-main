import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Moliyaviy hisobot — server tomonda agregatsiya (RPC). Faqat reports.view.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "reports.view" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const startStr = sp.get("start");
  const endStr = sp.get("end");
  if (!startStr || !endStr) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }
  const lengthMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - lengthMs);

  const admin = createAdminClient();

  // Komissiya foizlari (sozlamalardan)
  const { data: cs } = await admin.from("site_settings").select("value").eq("key", "betcore_commission").maybeSingle();
  const cfg = (cs?.value as any) ?? {};
  const topupPct = Number(cfg.topup_pct ?? 8);
  const withdrawPct = Number(cfg.withdraw_pct ?? 2);

  const [{ data: cur }, { data: prev }] = await Promise.all([
    admin.rpc("betcore_financial_report", { p_start: start.toISOString(), p_end: end.toISOString() }),
    admin.rpc("betcore_financial_report", { p_start: prevStart.toISOString(), p_end: start.toISOString() }),
  ]);

  const comm = (r: any) => {
    const topupVol = Number(r?.topup_volume ?? 0);
    const withdrawVol = Number(r?.withdraw_volume ?? 0);
    const topupCommission = topupVol * topupPct / 100;
    const withdrawCommission = withdrawVol * withdrawPct / 100;
    const totalCommission = topupCommission + withdrawCommission;
    const bonusSpend = 0; // bonus tizimi hali yo'q
    return {
      topupVolume: topupVol,
      withdrawVolume: withdrawVol,
      topupCommission,
      withdrawCommission,
      totalCommission,
      bonusSpend,
      netProfit: totalCommission - bonusSpend,
      completedCount: Number(r?.completed_count ?? 0),
      rejectedCount: Number(r?.rejected_count ?? 0),
      pendingCount: Number(r?.pending_count ?? 0),
    };
  };

  const current = comm(cur);
  const previous = comm(prev);

  // Hamkorlar / operatorlar nomlari
  const byPartner = ((cur as any)?.by_partner ?? []) as any[];
  const byOperator = ((cur as any)?.by_operator ?? []) as any[];
  const pids = Array.from(new Set(byPartner.map((x) => x.partner_id).filter(Boolean)));
  const oids = Array.from(new Set(byOperator.map((x) => x.operator_id).filter(Boolean)));
  const pName: Record<string, string> = {};
  const oName: Record<string, string> = {};
  if (pids.length) { const { data } = await admin.from("partners").select("id, name").in("id", pids); for (const p of (data ?? []) as any[]) pName[p.id] = p.name; }
  if (oids.length) { const { data } = await admin.from("profiles").select("id, full_name, display_name").in("id", oids); for (const p of (data ?? []) as any[]) oName[p.id] = p.display_name || p.full_name || "—"; }

  const partnerRows = byPartner.map((x) => {
    const tv = Number(x.topup_vol ?? 0), wv = Number(x.withdraw_vol ?? 0);
    return {
      name: x.partner_id ? (pName[x.partner_id] ?? "—") : "Platforma",
      topupVol: tv, withdrawVol: wv, count: Number(x.cnt ?? 0),
      commission: tv * topupPct / 100 + wv * withdrawPct / 100,
    };
  }).sort((a, b) => b.commission - a.commission);

  const paymentRows = (((cur as any)?.by_payment ?? []) as any[]).map((x) => ({
    method: x.payment_method,
    topupVol: Number(x.topup_vol ?? 0),
    withdrawVol: Number(x.withdraw_vol ?? 0),
    count: Number(x.cnt ?? 0),
  }));

  const operatorRows = byOperator.map((x) => ({
    name: oName[x.operator_id] ?? "—",
    count: Number(x.cnt ?? 0),
    vol: Number(x.vol ?? 0),
  })).sort((a, b) => b.count - a.count);

  const daily = ((cur as any)?.daily ?? []) as any[];

  return NextResponse.json({
    commissionPct: { topup: topupPct, withdraw: withdrawPct },
    current,
    previous,
    partnerRows,
    paymentRows,
    operatorRows,
    daily,
  });
}
