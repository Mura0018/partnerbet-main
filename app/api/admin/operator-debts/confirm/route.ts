import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 6-BOSQICH: ikki tomon tasdiqi. Qarzdor "To'ladim", haqdor "Oldim" bosadi.
// IKKALASI tasdiqlaса -> status 'paid' (yopiladi). Har tomon faqat O'Z
// tasdig'ini qo'yadi (kim ekanига qarab). Vaqt bilan qayd qilinadi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { debtId } = body ?? {};
  if (!debtId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: debt } = await admin
    .from("operator_debts")
    .select("id, debtor_operator_id, creditor_operator_id, debtor_confirmed_at, creditor_confirmed_at, status")
    .eq("id", debtId)
    .maybeSingle();
  if (!debt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((debt as any).status === "paid") return NextResponse.json({ ok: true, status: "paid", already: true });

  const isDebtor = (debt as any).debtor_operator_id === user.id;
  const isCreditor = (debt as any).creditor_operator_id === user.id;
  if (!isDebtor && !isCreditor) return NextResponse.json({ ok: false, error: "not_party" }, { status: 403 });

  const now = new Date().toISOString();
  const debtorAt = (debt as any).debtor_confirmed_at ?? (isDebtor ? now : null);
  const creditorAt = (debt as any).creditor_confirmed_at ?? (isCreditor ? now : null);
  const status = debtorAt && creditorAt ? "paid" : debtorAt ? "debtor_confirmed" : creditorAt ? "creditor_confirmed" : "open";

  const { error } = await admin
    .from("operator_debts")
    .update({ debtor_confirmed_at: debtorAt, creditor_confirmed_at: creditorAt, status })
    .eq("id", debtId)
    .neq("status", "paid");
  if (error) return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });

  // Yopilса jamoa chatiga xabar (best-effort).
  if (status === "paid") {
    try {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", [(debt as any).debtor_operator_id, (debt as any).creditor_operator_id].filter(Boolean));
      const nm = (id: string) => {
        const p = (profs ?? []).find((x: any) => x.id === id);
        return (p as any)?.display_name || (p as any)?.full_name || "Operator";
      };
      await admin.from("team_chat_messages").insert({
        sender_id: user.id,
        is_system: true,
        message: `💚 Tizim: ${nm((debt as any).debtor_operator_id)} → ${nm((debt as any).creditor_operator_id)} qarzi ikki tomon tasdig'i bilan yopildi.`,
      });
    } catch {
      /* xabar best-effort */
    }
  }

  return NextResponse.json({ ok: true, status });
}
