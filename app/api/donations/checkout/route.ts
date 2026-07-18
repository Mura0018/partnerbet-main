import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getPaymentGatewayProvider } from "@/lib/donations/registry";
import { env } from "@/lib/env";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // --- Input validation (never trust the client for amount/currency) ---
  const amount = Number(body.amount);
  const currency = (body.currency ?? "USD").toUpperCase();
  if (!body.paymentMethodId || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  if (!["USD", "EUR", "UZS"].includes(currency)) {
    return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // --- Rate limit: prevents automated checkout-session spam ---
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("donations")
    .select("id", { count: "exact", head: true })
    .eq("payment_method_id", body.paymentMethodId)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const provider = await getPaymentGatewayProvider(body.paymentMethodId);
  if (!provider) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 400 });
  }

  const isAnonymous = !!body.isAnonymous;
  const { data: donation, error: insertError } = await admin
    .from("donations")
    .insert({
      payment_method_id: body.paymentMethodId,
      amount,
      currency,
      donor_name: isAnonymous ? null : sanitizeText(body.donorName, 80),
      message: sanitizeText(body.message, 500),
      is_anonymous: isAnonymous,
      is_public: body.isPublic !== false,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !donation) {
    return NextResponse.json({ error: "creation_failed" }, { status: 500 });
  }

  const result = await provider.createCheckoutSession({
    donationId: donation.id,
    amount,
    currency,
    successUrl: `${env.siteUrl}/support/thank-you?donation=${donation.id}`,
    cancelUrl: `${env.siteUrl}/support`,
  });

  if (!result.success) {
    await admin.from("donations").update({ status: "failed" }).eq("id", donation.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await admin.from("donations").update({ external_transaction_id: result.externalSessionId }).eq("id", donation.id);

  return NextResponse.json({ checkoutUrl: result.checkoutUrl });
}
