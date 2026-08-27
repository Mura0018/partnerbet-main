import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { generateCardCode } from "@/lib/cards/generateCode";

export const dynamic = "force-dynamic";

const MAX_QTY = 5000;

async function guard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, userId: null };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cards.manage" });
  if (!allowed) return { ok: false as const, status: 403, userId: null };
  return { ok: true as const, status: 200, userId: user.id };
}

// Partiyalar ro'yxati + har partiyada holat bo'yicha sanoq (blank/assigned/cancelled).
export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });
  const admin = createAdminClient();

  const { data: batches } = await admin
    .from("card_batches")
    .select("id, label, quantity, note, created_at")
    .order("created_at", { ascending: false });

  const ids = (batches ?? []).map((b: any) => b.id);
  const counts: Record<string, { blank: number; assigned: number; cancelled: number }> = {};
  if (ids.length) {
    const { data: cards } = await admin.from("promo_cards").select("batch_id, status").in("batch_id", ids);
    for (const c of (cards ?? []) as any[]) {
      if (!c.batch_id) continue;
      const b = counts[c.batch_id] ?? (counts[c.batch_id] = { blank: 0, assigned: 0, cancelled: 0 });
      if (c.status === "blank") b.blank++;
      else if (c.status === "assigned") b.assigned++;
      else if (c.status === "cancelled") b.cancelled++;
    }
  }

  return NextResponse.json({
    batches: (batches ?? []).map((b: any) => ({
      ...b,
      counts: counts[b.id] ?? { blank: 0, assigned: 0, cancelled: 0 },
    })),
  });
}

// Partiya yaratish -> N ta noyob BLANK karta kodi generatsiya + yozish.
// Pul harakati YO'Q. Atomiklik: kodlar bitta INSERT bilan (to'qnashsa butun
// insert bekor -> partiya o'chiriladi, "qayta urining").
export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: "forbidden" }, { status: g.status });

  const body = await req.json().catch(() => null);
  const label = String(body?.label ?? "").trim().slice(0, 100);
  const quantity = Math.floor(Number(body?.quantity));
  const note = body?.note ? String(body.note).trim().slice(0, 500) : null;

  if (!label) return NextResponse.json({ error: "label_required" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
    return NextResponse.json({ error: "invalid_quantity", max: MAX_QTY }, { status: 400 });
  }

  // Partiya ichida noyob kodlar (kriptografik tasodifiy).
  const codes = new Set<string>();
  let guardLoop = 0;
  while (codes.size < quantity && guardLoop < quantity * 20) {
    codes.add(generateCardCode());
    guardLoop++;
  }
  if (codes.size < quantity) return NextResponse.json({ error: "generate_failed" }, { status: 500 });

  const admin = createAdminClient();

  const { data: batch, error: bErr } = await admin
    .from("card_batches")
    .insert({ label, quantity, note, created_by: g.userId })
    .select("id")
    .single();
  if (bErr || !batch) return NextResponse.json({ error: "batch_failed" }, { status: 500 });

  const rows = [...codes].map((c) => ({ card_code: c, status: "blank", batch_id: (batch as any).id }));
  const { error: cErr } = await admin.from("promo_cards").insert(rows);
  if (cErr) {
    // Global unique to'qnashuvi (nihoyatda kam) yoki xato -> kompensatsiya.
    await admin.from("card_batches").delete().eq("id", (batch as any).id);
    return NextResponse.json({ error: "code_conflict_retry" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, batchId: (batch as any).id, quantity });
}
