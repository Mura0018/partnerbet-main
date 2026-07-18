import crypto from "crypto";
import type { PaymentGatewayProvider, CheckoutSessionResult, WebhookVerificationResult } from "@/lib/donations/types";

// Real Stripe Checkout Sessions + webhook signature verification
// (Stripe's REST API is stable and extremely well documented — unlike
// Live Streaming, there's no ambiguity about the real API shape here).
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 300; // reject replayed webhooks older than 5 minutes

export class StripeProvider implements PaymentGatewayProvider {
  readonly key = "stripe";
  readonly name = "Stripe";

  constructor(private secretKey: string, private webhookSecret: string | null) {}

  async createCheckoutSession(params: {
    donationId: string; amount: number; currency: string; successUrl: string; cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    try {
      const body = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": params.currency.toLowerCase(),
        "line_items[0][price_data][product_data][name]": "Donation to PartnerBet",
        "line_items[0][price_data][unit_amount]": String(Math.round(params.amount * 100)),
        "line_items[0][quantity]": "1",
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        "metadata[donation_id]": params.donationId,
      });

      const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return { success: false, error: errorBody?.error?.message ?? `Stripe ${res.status} xatosi qaytardi.` };
      }

      const session = await res.json();
      return { success: true, checkoutUrl: session.url, externalSessionId: session.id };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Stripe bilan bog'lanishda xatolik." };
    }
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult> {
    if (!this.webhookSecret) return { verified: false };

    const signatureHeader = headers.get("stripe-signature");
    if (!signatureHeader) return { verified: false };

    const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=") as [string, string]));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return { verified: false };

    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
      return { verified: false }; // stale/replayed
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const valid =
      expectedSignature.length === v1.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(v1));

    if (!valid) return { verified: false };

    const event = JSON.parse(rawBody);
    const session = event.data?.object;
    if (event.type !== "checkout.session.completed" || !session) return { verified: false };

    return {
      verified: true,
      externalTransactionId: session.id,
      status: session.payment_status === "paid" ? "completed" : "failed",
      amount: session.amount_total ? session.amount_total / 100 : undefined,
      currency: session.currency?.toUpperCase(),
    };
  }
}
