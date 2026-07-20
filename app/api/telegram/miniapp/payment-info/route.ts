import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Without this, Next.js can statically render this GET handler once at
// build time (no Request/cookies/headers usage triggers that) and keep
// serving that frozen snapshot in production forever — which is exactly
// why a payment method added after deploy wasn't showing up.
export const dynamic = "force-dynamic";

type MethodRow = { method_type: string; account_number: string; holder_name: string | null };

function pickRandom(rows: MethodRow[], type: string): MethodRow | null {
  const matching = rows.filter((r) => r.method_type === type);
  if (matching.length === 0) return null;
  return matching[Math.floor(Math.random() * matching.length)];
}

// Non-secret by design — card/Click/Payme numbers and the crypto wallet
// address must be shown to the customer to complete a top-up. One active
// entry per method type is picked at random among all operators who have
// that type configured, spreading incoming payments across operators
// instead of concentrating them on a single account.
export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("telegram_operator_payment_methods")
    .select("method_type, account_number, holder_name")
    .eq("is_active", true);

  const rows = (data as MethodRow[]) ?? [];
  const card = pickRandom(rows, "card");
  const click = pickRandom(rows, "click");
  const payme = pickRandom(rows, "payme");
  const crypto = pickRandom(rows, "crypto");

  return NextResponse.json(
    {
      cardNumber: card?.account_number ?? "",
      cardHolder: card?.holder_name ?? "",
      clickNumber: click?.account_number ?? "",
      clickHolder: click?.holder_name ?? "",
      paymeNumber: payme?.account_number ?? "",
      paymeHolder: payme?.holder_name ?? "",
      cryptoWallet: crypto?.account_number ?? "",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
