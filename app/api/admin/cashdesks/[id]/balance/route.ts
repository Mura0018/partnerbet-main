import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskCredsById } from "@/lib/cashdesk/store";
import { getCashdeskBalance } from "@/lib/cashdesk/client";
import { handleLowBalanceAlert, isLowBalance } from "@/lib/cashdesk/lowBalanceAlert";
import { startTimeout } from "@/lib/net/timeout";

// Bitta kassa balansi (non-blocking — panel har qatorni alohida chaqiradi).
// Xato bo'lsa { ok:false } -> panelda "balans olinmadi". Balans chegaradan
// past bo'lsa: low=true (panelda qizil belgi) + super_admin Telegram
// (6 soatda 1 marta — ATOMIK throttling, lib/cashdesk/lowBalanceAlert.ts;
// soatlik cron bilan bir vaqtda ishlasa ham bitta xabar ketadi).

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("cashdesks")
    .select("id, name, low_balance_threshold, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const creds = await getCashdeskCredsById(id);
  if (!creds) return NextResponse.json({ ok: false, error: "not_configured" });

  // 5s timeout (faqat o'qish) — osilgan API panel qatorini cheksiz kutdirmaydi;
  // abort -> network_error -> panelda "balans olinmadi".
  const tmo = startTimeout(5000);
  let result: Awaited<ReturnType<typeof getCashdeskBalance>>;
  try {
    result = await getCashdeskBalance(creds, { signal: tmo.signal });
  } finally {
    tmo.clear();
  }
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error });

  const balance = result.data.Balance;
  const threshold = row.low_balance_threshold != null ? Number(row.low_balance_threshold) : null;
  const low = isLowBalance(balance, threshold);

  // Alert (yon ta'sir, best-effort) — xato javobni buzmaydi.
  await handleLowBalanceAlert(admin, { id, name: row.name, balance, threshold });

  return NextResponse.json({ ok: true, balance, limit: result.data.Limit, low });
}
