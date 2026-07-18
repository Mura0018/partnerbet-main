import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Crypto donations cannot be verified automatically (no blockchain
// monitoring is implemented — see DONATION_SYSTEM.md for why that's out
// of scope). A donor who has sent funds manually can report it here,
// creating a 'pending' donation row an admin later confirms/marks
// 'completed' once they see the transaction on-chain or in their wallet.
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function sanitizeText(value: string | undefined, maxLength: number): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  let body: {
    paymentMethodId?: string; amount?: number; currency?: string;
    donorName?: string; message?: string; isAnonymous?: boolean; isPublic?: boolean;
    transactionHash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!body.paymentMethodId || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: method } = await admin
    .from("payment_methods")
    .select("id, method_type, is_active")
    .eq("id", body.paymentMethodId)
    .eq("method_type", "crypto")
    .is("deleted_at", null)
    .maybeSingle();
  if (!method || !method.is_active) {
    return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("donations")
    .select("id", { count: "exact", head: true })
    .eq("payment_method_id", body.paymentMethodId)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const isAnonymous = !!body.isAnonymous;
  const { error: insertError } = await admin.from("donations").insert({
    payment_method_id: body.paymentMethodId,
    amount,
    currency: (body.currency ?? "USD").toUpperCase(),
    donor_name: isAnonymous ? null : sanitizeText(body.donorName, 80),
    message: sanitizeText(body.message, 500),
    is_anonymous: isAnonymous,
    is_public: body.isPublic !== false,
    status: "pending", // an admin manually confirms crypto donations after checking the wallet
    external_transaction_id: sanitizeText(body.transactionHash, 200),
  });

  if (insertError) {
    return NextResponse.json({ error: "creation_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
