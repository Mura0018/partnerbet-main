import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
//  1) BARCHA aktiv kassalar PARALLEL tekshiriladi (Promise.allSettled).
//     Har kassaning balans olish qismi BALANCE_TIMEOUT_MS bilan cheklangan:
//     muddat o'tsa fetch AbortController bilan bekor qilinadi va snapshot
//     ok=false, error="timeout" bilan yoziladi. Bitta osilgan kassa
//     qolganlarini kutdirmaydi.
//  2) Har kassa uchun cashdesk_balance_snapshots qatori (threshold'i
//     yo'qlari ham — tarix to'liq; xato bo'lsa ham ok=false + error).
//  3) Past balans alerti — lib/cashdesk/lowBalanceAlert.ts (atomik,
//     har kassa o'z qatorini qulflaydi -> parallel ishlash xavfsiz).
//     Xabar faqat threshold'i borlarga.
// =========================================================

// Eng yomon holat: ro'yxat so'rovi + 5s (parallel balanslar) + snapshot/
// alert (DB + Telegram, ularda alohida timeout yo'q). Vercel'ning standart
// limiti rejaga qarab 10-15s bo'lishi mumkin — zaxira uchun aniq chegara.
export const maxDuration = 30;

const BALANCE_TIMEOUT_MS = 5000;

type Desk = { id: string; name: string; low_balance_threshold: number | null };
type Fetched = { ok: boolean; balance: number | null; creditLimit: number | null; error: string | null };
type DeskOutcome = { ok: boolean; isLow: boolean; notified: boolean; snapshotError: boolean };

// creds o'qish + imzo sozlamasi + API chaqiruvi — hammasi bitta timeout ichida.
async function fetchDeskBalance(deskId: string): Promise<Fetched> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<Fetched>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, balance: null, creditLimit: null, error: "timeout" });
    }, BALANCE_TIMEOUT_MS);
  });

  const work = (async (): Promise<Fetched> => {
    try {
      const creds = await getCashdeskCredsById(deskId);
      if (!creds) return { ok: false, balance: null, creditLimit: null, error: "not_configured" };
      const result = await getCashdeskBalance(creds, { signal: controller.signal });
      if (!result.ok) return { ok: false, balance: null, creditLimit: null, error: result.error };
      return { ok: true, balance: result.data.Balance, creditLimit: result.data.Limit, error: null };
    } catch (e) {
      return { ok: false, balance: null, creditLimit: null, error: e instanceof Error ? e.message : "unknown_error" };
    }
  })();

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function processDesk(admin: SupabaseClient, desk: Desk): Promise<DeskOutcome> {
  const threshold = desk.low_balance_threshold != null ? Number(desk.low_balance_threshold) : null;
  const fetched = await fetchDeskBalance(desk.id);
  const isLow = fetched.ok && isLowBalance(fetched.balance, threshold);

  let snapshotError = false;
  try {
    const { error } = await admin.from("cashdesk_balance_snapshots").insert({
      cashdesk_id: desk.id,
      ok: fetched.ok,
      balance: fetched.balance,
      credit_limit: fetched.creditLimit,
      threshold,
      is_low: isLow,
      error: fetched.error,
    });
    if (error) snapshotError = true;
  } catch {
    snapshotError = true;
  }

  let notified = false;
  if (fetched.ok) {
    const outcome = await handleLowBalanceAlert(admin, {
      id: desk.id,
      name: desk.name,
      balance: fetched.balance,
      threshold,
    });
    notified = outcome === "notified";
  }

  return { ok: fetched.ok, isLow, notified, snapshotError };
}

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

  const list = (desks ?? []) as Desk[];
  const settled = await Promise.allSettled(list.map((d) => processDesk(admin, d)));

  let failed = 0;
  let low = 0;
  let notified = 0;
  let snapshotErrors = 0;
  let crashed = 0;

  for (const s of settled) {
    if (s.status === "rejected") {
      crashed++;
      failed++;
      continue;
    }
    if (!s.value.ok) failed++;
    if (s.value.isLow) low++;
    if (s.value.notified) notified++;
    if (s.value.snapshotError) snapshotErrors++;
  }

  return NextResponse.json({ checked: list.length, failed, low, notified, snapshotErrors, crashed });
}
