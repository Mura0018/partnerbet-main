import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { assignedCashdeskIds, FILL_PERMISSION } from "@/lib/cashdesk/fillers";
import { isLowBalance } from "@/lib/cashdesk/lowBalanceAlert";

// =========================================================
// 6b — To'ldiruvchi sahifasi uchun kassa balanslari (FAQAT O'QISH).
//
// XAVFSIZLIK:
//  - Ma'lumot FAQAT cashdesk_balance_snapshots'dan (soatlik cron yozadi).
//    1xBet API'ga jonli chaqiruv YO'Q — to'ldiruvchi API'ni urib tura olmaydi.
//  - cashdesks'dan FAQAT: id, name, region, low_balance_threshold, is_active.
//    login / pass_enc / hash_enc / cashdesk_id so'ralmaydi va qaytmaydi.
//  - Snapshot'ning error matni qaytarilmaydi (tashqi API xabari bo'lishi mumkin).
//
// Ko'rinish doirasi: cashdesks.manage -> barcha aktiv kassalar; aks holda
// biriktirilgan kassalar, birortasi biriktirilmagan bo'lsa -> barcha aktiv.
// =========================================================

type DeskRow = { id: string; name: string; region: string | null; low_balance_threshold: number | null; is_active: boolean };
type SnapRow = { ok: boolean; balance: number | null; taken_at: string };

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: canFill } = await supabase.rpc("has_permission", { perm_key: FILL_PERMISSION });
  if (!canFill) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: canManage } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });

  const admin = createAdminClient();

  let scope: "manager" | "all" | "assigned" = "manager";
  let assigned: string[] = [];
  if (!canManage) {
    try {
      assigned = await assignedCashdeskIds(admin, user.id);
    } catch {
      return NextResponse.json({ error: "load_failed" }, { status: 500 });
    }
    scope = assigned.length > 0 ? "assigned" : "all";
  }

  let q = admin
    .from("cashdesks")
    .select("id, name, region, low_balance_threshold, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (scope === "assigned") q = q.in("id", assigned);
  const { data: desks, error } = await q;
  if (error) return NextResponse.json({ error: "load_failed" }, { status: 500 });

  const rows = await Promise.all(
    ((desks ?? []) as DeskRow[]).map(async (d) => {
      const threshold = d.low_balance_threshold != null ? Number(d.low_balance_threshold) : null;
      let latest: SnapRow | null = null;
      let lastGood: SnapRow | null = null;
      try {
        const { data: l } = await admin
          .from("cashdesk_balance_snapshots")
          .select("ok, balance, taken_at")
          .eq("cashdesk_id", d.id)
          .order("taken_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latest = (l as SnapRow | null) ?? null;
        if (latest?.ok) {
          lastGood = latest;
        } else if (latest) {
          const { data: g } = await admin
            .from("cashdesk_balance_snapshots")
            .select("ok, balance, taken_at")
            .eq("cashdesk_id", d.id)
            .eq("ok", true)
            .order("taken_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          lastGood = (g as SnapRow | null) ?? null;
        }
      } catch {
        /* snapshot o'qilmadi — "hali tekshirilmagan" ko'rinadi */
      }
      const balance = lastGood?.balance != null ? Number(lastGood.balance) : null;
      return {
        id: d.id,
        name: d.name,
        region: d.region,
        threshold,
        checkedAt: latest?.taken_at ?? null,
        lastCheckOk: latest ? latest.ok : null,
        balance,
        balanceAt: lastGood?.taken_at ?? null,
        // Hozirgi chegara bilan baholanadi (chegara keyin o'zgargan bo'lishi mumkin).
        isLow: isLowBalance(balance, threshold),
      };
    })
  );

  // Biriktirilgan, lekin hozir nofaol kassalar soni (o'chirilganlari cascade
  // bilan cashdesk_fillers'dan ketadi, demak qolgan farq = nofaol kassalar).
  const inactiveAssigned = scope === "assigned" ? Math.max(0, assigned.length - rows.length) : 0;

  return NextResponse.json(
    { scope, assignedCount: assigned.length, inactiveAssigned, desks: rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}
