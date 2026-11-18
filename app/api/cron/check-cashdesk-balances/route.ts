import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskCredsById } from "@/lib/cashdesk/store";
import { getCashdeskBalance } from "@/lib/cashdesk/client";
import { handleLowBalanceAlert, isLowBalance } from "@/lib/cashdesk/lowBalanceAlert";

// =========================================================
// 5b — SOATLIK KASSA BALANSI TEKSHIRUVI.
// Tashqi scheduler HAR SOATDA uradi (check-stale-claims bilan bir xil
// naqsh: CRON_CHECK_SECRET ?secret= bilan mos kelishi shart). Tezlikni
// oshirish kerak bo'lsa — faqat scheduler sozlamasi, kod o'zgarmaydi.
//
//  1) BARCHA aktiv kassalar balansi olinadi va cashdesk_balance_snapshots
//     ga yoziladi (threshold'i yo'qlari ham — tarix to'liq). API xato
//     bersa ham qator yoziladi (ok=false + error).
//  2) Past balans alerti — lib/cashdesk/lowBalanceAlert.ts (atomik):
//     balans sahifasi bilan bir vaqtda ishlasa ham BITTA xabar ketadi.
//     Xabar faqat threshold'i borlarga (threshold yo'q -> low emas).
//
// Bir kassaning xatosi qolganlarini to'xtatmaydi.
// =========================================================
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_CHECK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: desks, error: listError } = await admin
    .from("cashdesks")
    .select("id, name, low_balance_threshold")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (listError) return NextResponse.json({ error: "list_failed" }, { status: 500 });

  let checked = 0;
  let failed = 0;
  let low = 0;
  let notified = 0;
  let snapshotErrors = 0;

  for (const desk of (desks ?? []) as { id: string; name: string; low_balance_threshold: number | null }[]) {
    checked++;
    const threshold = desk.low_balance_threshold != null ? Number(desk.low_balance_threshold) : null;

    let ok = false;
    let balance: number | null = null;
    let creditLimit: number | null = null;
    let errorText: string | null = null;

    try {
      const creds = await getCashdeskCredsById(desk.id);
      if (!creds) {
        errorText = "not_configured";
      } else {
        const result = await getCashdeskBalance(creds);
        if (result.ok) {
          ok = true;
          balance = result.data.Balance;
          creditLimit = result.data.Limit;
        } else {
          errorText = result.error;
        }
      }
    } catch (e) {
      errorText = e instanceof Error ? e.message : "unknown_error";
    }

    const isLow = ok && isLowBalance(balance, threshold);
    if (!ok) failed++;
    if (isLow) low++;

    const { error: insertError } = await admin.from("cashdesk_balance_snapshots").insert({
      cashdesk_id: desk.id,
      ok,
      balance,
      credit_limit: creditLimit,
      threshold,
      is_low: isLow,
      error: errorText,
    });
    if (insertError) snapshotErrors++;

    if (ok) {
      const outcome = await handleLowBalanceAlert(admin, { id: desk.id, name: desk.name, balance, threshold });
      if (outcome === "notified") notified++;
    }
  }

  return NextResponse.json({ checked, failed, low, notified, snapshotErrors });
}
