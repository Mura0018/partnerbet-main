import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 6-BOSQICH: smena yakuni — operatorning OCHIQ qarzlarini (paid emas) jamoa
// chatiga e'lon qiladi (hodisa-asosli tizim xabari). Ikki tomon shu yerdan
// "To'ladim"/"Oldim" bilan tasdiqlaydi (confirm API).
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: debts } = await admin
    .from("operator_debts")
    .select("debtor_operator_id, creditor_operator_id, amount, status")
    .or(`debtor_operator_id.eq.${user.id},creditor_operator_id.eq.${user.id}`)
    .neq("status", "paid");

  const rows = (debts ?? []) as any[];
  if (rows.length === 0) return NextResponse.json({ ok: true, count: 0 });

  const ids = Array.from(new Set(rows.flatMap((d) => [d.debtor_operator_id, d.creditor_operator_id]).filter(Boolean)));
  const nameById: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, display_name, full_name").in("id", ids);
    for (const p of (profs ?? []) as any[]) nameById[p.id] = p.display_name || p.full_name || "Operator";
  }
  const nm = (id: string | null) => (id ? nameById[id] ?? "Operator" : "—");

  const lines = rows.map((d) => `• ${nm(d.debtor_operator_id)} → ${nm(d.creditor_operator_id)}: ${Number(d.amount || 0).toLocaleString("ru-RU")} so'm`);
  const meName = nm(user.id);

  try {
    await admin.from("team_chat_messages").insert({
      sender_id: user.id,
      is_system: true,
      message: `🧾 Tizim: ${meName} smenani yakunladi. Ochiq qarzlar:\n${lines.join("\n")}\n\nTaraflar "Qarzlar" bo'limida To'ladim/Oldim bilan tasdiqlasin.`,
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
