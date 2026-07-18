import crypto from "crypto";
import type { PaymentGatewayProvider, CheckoutSessionResult, WebhookVerificationResult } from "@/lib/donations/types";

// Documented, generic REST + HMAC-webhook contract — NOT a real named
// service's actual API, exactly like GenericRestStreamingProvider
// (v1.1.0). This is the extension point for a future "Other" gateway:
// if its real API happens to match this contract, admin can select
// provider_key = 'generic' and it works with zero code changes. If a
// real provider's API differs, add a dedicated class implementing
// PaymentGatewayProvider instead (see stripeProvider.ts / paypalProvider.ts).
//
//   POST {baseApiUrl}/checkout
//     Headers: X-Api-Key: <key>
//     Body: { amount, currency, donation_id, success_url, cancel_url }
//     200 OK: { "checkout_url": "...", "session_id": "..." }
//
//   Webhook (sent by the provider to /api/donations/webhook/{methodKey}):
//     Header: X-Signature = hex HMAC-SHA256(rawBody, apiSecret)
//     Body: { "session_id": "...", "status": "completed" | "failed", "amount": 12.5, "currency": "USD" }
export class GenericPaymentProvider implements PaymentGatewayProvider {
  readonly key = "generic";
  readonly name: string;

  constructor(private baseApiUrl: string, private apiKey: string, private apiSecret: string | null, name?: string) {
    this.name = name ?? "Generic Provider";
  }

  async createCheckoutSession(params: {
    donationId: string; amount: number; currency: string; successUrl: string; cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    try {
      const res = await fetch(`${this.baseApiUrl.replace(/\/$/, "")}/checkout`, {
        method: "POST",
        headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: params.amount, currency: params.currency, donation_id: params.donationId,
          success_url: params.successUrl, cancel_url: params.cancelUrl,
        }),
      });
      if (!res.ok) return { success: false, error: `Provider ${res.status} bilan javob berdi.` };
      const data = await res.json();
      if (!data?.checkout_url) return { success: false, error: "Provайder checkout URL qaytarmadi." };
      return { success: true, checkoutUrl: data.checkout_url, externalSessionId: data.session_id ?? params.donationId };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Provайder bilan bog'lanishda xatolik." };
    }
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult> {
    if (!this.apiSecret) return { verified: false };
    const signature = headers.get("x-signature");
    if (!signature) return { verified: false };

    const expected = crypto.createHmac("sha256", this.apiSecret).update(rawBody).digest("hex");
    const valid = expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) return { verified: false };

    const event = JSON.parse(rawBody);
    if (event.status !== "completed" && event.status !== "failed") return { verified: false };

    return {
      verified: true,
      externalTransactionId: event.session_id,
      status: event.status,
      amount: event.amount,
      currency: event.currency,
    };
  }
}
