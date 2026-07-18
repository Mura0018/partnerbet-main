import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getPaymentGatewayProvider } from "@/lib/donations/registry";

// Inbound webhook from a payment gateway (Stripe/PayPal). The RAW request
// body (req.text(), not req.json()) is required for signature
// verification — parsing to JSON first would change the exact bytes the
// signature was computed over.
export async function POST(req: NextRequest, { params }: { params: Promise<{ methodKey: string }> }) {
  const { methodKey } = await params;
  const admin = createAdminClient();

  const { data: method } = await admin
    .from("payment_methods")
    .select("id")
    .eq("key", methodKey)
    .eq("method_type", "gateway")
    .is("deleted_at", null)
    .maybeSingle();

  if (!method) {
    return NextResponse.json({ error: "unknown_method" }, { status: 404 });
  }

  const rawBody = await req.text();
  const provider = await getPaymentGatewayProvider(method.id);
  if (!provider) {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 400 });
  }

  const verification = await provider.verifyWebhook(rawBody, req.headers);

  // Every webhook attempt is logged — verified or not — so a rejected/
  // forged attempt is visible to admins instead of silently disappearing.
  const { data: logRow } = await admin
    .from("donation_webhook_log")
    .insert({
      payment_method_id: method.id,
      verified: verification.verified,
      event_type: verification.verified ? verification.status : null,
      raw_payload: (() => {
        try {
          return JSON.parse(rawBody);
        } catch {
          return null;
        }
      })(),
    })
    .select("id")
    .single();

  if (!verification.verified) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const { data: donation } = await admin
    .from("donations")
    .select("id")
    .eq("external_transaction_id", verification.externalTransactionId)
    .maybeSingle();

  if (donation) {
    await admin.from("donations").update({ status: verification.status }).eq("id", donation.id);
    if (logRow) {
      await admin.from("donation_webhook_log").update({ donation_id: donation.id }).eq("id", logRow.id);
    }
  }

  return NextResponse.json({ received: true });
}
