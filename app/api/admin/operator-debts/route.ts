import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 6-BOSQICH: operatorning O'Z qarzlari — u qarzdor (debtor) yoki haqdor
// (creditor) bo'lganlar + sof balans. Maxfiy narsa yo'q (faqat ism/summa).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: debts } = await admin
    .from("operator_debts")
    .select("id, debtor_operator_id, creditor_operator_id, order_id, amount, status, debtor_confirmed_at, creditor_confirmed_at, note, created_at")
    .or(`debtor_operator_id.eq.${user.id},creditor_operator_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (debts ?? []) as any[];

  // Ismlar
  const ids = Array.from(new Set(rows.flatMap((d) => [d.debtor_operator_id, d.creditor_operator_id]).filter(Boolean)));
  const nameById: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, display_name, full_name").in("id", ids);
    for (const p of (profs ?? []) as any[]) nameById[p.id] = p.display_name || p.full_name || "Operator";
  }

  // Sof balans (faqat paid emas)
  let iOwe = 0;
  let owedToMe = 0;
  for (const d of rows) {
    if (d.status === "paid") continue;
    if (d.debtor_operator_id === user.id) iOwe += Number(d.amount || 0);
    if (d.creditor_operator_id === user.id) owedToMe += Number(d.amount || 0);
  }

  const debtsOut = rows.map((d) => ({
    ...d,
    debtor_name: d.debtor_operator_id ? nameById[d.debtor_operator_id] ?? "Operator" : "—",
    creditor_name: d.creditor_operator_id ? nameById[d.creditor_operator_id] ?? "Operator" : "—",
    i_am_debtor: d.debtor_operator_id === user.id,
    i_am_creditor: d.creditor_operator_id === user.id,
  }));

  return NextResponse.json({
    me: user.id,
    debts: debtsOut,
    summary: { iOwe, owedToMe, net: owedToMe - iOwe },
  });
}
