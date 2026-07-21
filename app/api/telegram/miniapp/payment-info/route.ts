import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Without this, Next.js can statically render this GET handler once at
// build time (no Request/cookies/headers usage triggers that) and keep
// serving that frozen snapshot in production forever — which is exactly
// why a payment method added after deploy wasn't showing up.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type MethodRow = {
  id: string;
  operator_id: string;
  method_type: string;
  account_number: string;
  holder_name: string | null;
  usage_count: number;
};

// Fair pick: among active cards of this type, prefer whichever operator
// currently has the FEWEST pending orders claimed (i.e. isn't busy right
// now), then — among cards tied on that — whichever has been shown the
// FEWEST times (usage_count), so load rotates evenly instead of piling
// onto whoever's card the random pick happened to favor. A little
// randomness is kept only to break ties within the same busy/usage tier,
// so it's not perfectly predictable which operator gets picked next.
function pickFair(rows: MethodRow[], type: string, busyScore: Record<string, number>): MethodRow | null {
  const matching = rows.filter((r) => r.method_type === type);
  if (matching.length === 0) return null;

  let best: MethodRow[] = [];
  let bestKey = Infinity;
  for (const row of matching) {
    const busy = busyScore[row.operator_id] ?? 0;
    // Combine busy-ness and usage into one sortable number: busy count
    // matters far more than usage count, so weight it heavily.
    const key = busy * 1000 + row.usage_count;
    if (key < bestKey) {
      bestKey = key;
      best = [row];
    } else if (key === bestKey) {
      best.push(row);
    }
  }
  return best[Math.floor(Math.random() * best.length)];
}

// Non-secret by design — card/Click/Payme numbers and the crypto wallet
// address must be shown to the customer to complete a top-up. Each
// picked entry's operator_id is returned too — the Mini App sends it
// back when the order is created so whoever resolves the order later
// can see exactly whose account the money actually went to (see 0049),
// and so /api/telegram/miniapp/orders can bump that card's usage_count.
export async function GET() {
  const supabase = createAdminClient();

  const [{ data: methodsData }, { data: pendingData }, { data: onlineData }] = await Promise.all([
    supabase
      .from("telegram_operator_payment_methods")
      .select("id, operator_id, method_type, account_number, holder_name, usage_count")
      .eq("is_active", true),
    supabase.from("telegram_orders").select("claimed_by").eq("status", "pending").not("claimed_by", "is", null),
    supabase.from("profiles").select("id, is_online"),
  ]);

  const onlineIds = new Set((onlineData ?? []).filter((p) => p.is_online).map((p) => p.id));
  let rows = (methodsData as MethodRow[]) ?? [];

  // Prefer operators who marked themselves "Faol" — but if that would
  // leave a method type with zero candidates (e.g. everyone forgot to
  // toggle back on), fall back to considering everyone rather than
  // showing the customer nothing at all.
  for (const type of ["card", "click", "payme", "crypto"]) {
    const onlineOnly = rows.filter((r) => r.method_type !== type || onlineIds.has(r.operator_id));
    const hasOnlineCandidate = rows.some((r) => r.method_type === type && onlineIds.has(r.operator_id));
    if (hasOnlineCandidate) rows = rows.filter((r) => r.method_type !== type || onlineIds.has(r.operator_id));
  }

  const busyScore: Record<string, number> = {};
  for (const row of pendingData ?? []) {
    if (row.claimed_by) busyScore[row.claimed_by] = (busyScore[row.claimed_by] ?? 0) + 1;
  }

  const card = pickFair(rows, "card", busyScore);
  const click = pickFair(rows, "click", busyScore);
  const payme = pickFair(rows, "payme", busyScore);
  const crypto = pickFair(rows, "crypto", busyScore);

  return NextResponse.json(
    {
      cardNumber: card?.account_number ?? "",
      cardHolder: card?.holder_name ?? "",
      cardOperatorId: card?.operator_id ?? null,
      clickNumber: click?.account_number ?? "",
      clickHolder: click?.holder_name ?? "",
      clickOperatorId: click?.operator_id ?? null,
      paymeNumber: payme?.account_number ?? "",
      paymeHolder: payme?.holder_name ?? "",
      paymeOperatorId: payme?.operator_id ?? null,
      cryptoWallet: crypto?.account_number ?? "",
      cryptoOperatorId: crypto?.operator_id ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
