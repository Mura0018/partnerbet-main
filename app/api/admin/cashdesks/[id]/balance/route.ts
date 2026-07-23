import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskCredsById } from "@/lib/cashdesk/store";
import { getCashdeskBalance } from "@/lib/cashdesk/client";
import { notifySuperAdminsLowBalance } from "@/lib/telegram/notifyLowBalance";

// Bitta kassa balansi (non-blocking — panel har qatorni alohida chaqiradi).
// Xato bo'lsa { ok:false } -> panelda "balans olinmadi". Balans chegaradan
// past bo'lsa: low=true (panelda qizil belgi) + super_admin Telegram
// (6 soatda 1 marta — low_balance_notified_at bilan throttling, spamsiz).
const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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
    .select("id, name, low_balance_threshold, low_balance_notified_at, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const creds = await getCashdeskCredsById(id);
  if (!creds) return NextResponse.json({ ok: false, error: "not_configured" });

  const result = await getCashdeskBalance(creds);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error });

  const balance = result.data.Balance;
  const threshold = row.low_balance_threshold != null ? Number(row.low_balance_threshold) : null;
  const low = threshold != null && balance != null && balance < threshold;

  // Alert throttling (yon ta'sir) — javobni bloklamaydi.
  try {
    if (low) {
      const last = row.low_balance_notified_at ? new Date(row.low_balance_notified_at).getTime() : 0;
      if (Date.now() - last > NOTIFY_COOLDOWN_MS) {
        await admin.from("cashdesks").update({ low_balance_notified_at: new Date().toISOString() }).eq("id", id);
        await notifySuperAdminsLowBalance(row.name, balance, threshold as number);
      }
    } else if (row.low_balance_notified_at) {
      // Balans tiklandi -> keyingi tushishda yana xabar berish uchun tozalanadi.
      await admin.from("cashdesks").update({ low_balance_notified_at: null }).eq("id", id);
    }
  } catch {
    /* alert best-effort */
  }

  return NextResponse.json({ ok: true, balance, limit: result.data.Limit, low });
}
