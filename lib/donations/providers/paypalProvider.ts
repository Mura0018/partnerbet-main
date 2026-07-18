import type { PaymentGatewayProvider, CheckoutSessionResult, WebhookVerificationResult } from "@/lib/donations/types";

// Real PayPal Orders v2 API + webhook signature verification via PayPal's
// own verification endpoint (PayPal does not use a simple HMAC like
// Stripe — it requires calling back to their API with the transmission
// headers, which is what verifyWebhook does below).
const PAYPAL_API_BASE = "https://api-m.paypal.com";

export class PayPalProvider implements PaymentGatewayProvider {
  readonly key = "paypal";
  readonly name = "PayPal";

  constructor(private clientId: string, private clientSecret: string, private webhookId: string | null) {}

  private async getAccessToken(): Promise<string | null> {
    try {
      const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token ?? null;
    } catch {
      return null;
    }
  }

  async createCheckoutSession(params: {
    donationId: string; amount: number; currency: string; successUrl: string; cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    const token = await this.getAccessToken();
    if (!token) return { success: false, error: "PayPal autentifikatsiyasi muvaffaqiyatsiz." };

    try {
      const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: params.donationId,
              amount: { currency_code: params.currency, value: params.amount.toFixed(2) },
              description: "Donation to PartnerBet",
            },
          ],
          application_context: {
            return_url: params.successUrl,
            cancel_url: params.cancelUrl,
            user_action: "PAY_NOW",
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return { success: false, error: errorBody?.message ?? `PayPal ${res.status} xatosi qaytardi.` };
      }

      const order = await res.json();
      const approveLink = order.links?.find((l: any) => l.rel === "approve")?.href;
      if (!approveLink) return { success: false, error: "PayPal tasdiqlash havolasi topilmadi." };

      return { success: true, checkoutUrl: approveLink, externalSessionId: order.id };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "PayPal bilan bog'lanishda xatolik." };
    }
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult> {
    if (!this.webhookId) return { verified: false };

    const token = await this.getAccessToken();
    if (!token) return { verified: false };

    const webhookEvent = JSON.parse(rawBody);

    try {
      const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_algo: headers.get("paypal-auth-algo"),
          cert_url: headers.get("paypal-cert-url"),
          transmission_id: headers.get("paypal-transmission-id"),
          transmission_sig: headers.get("paypal-transmission-sig"),
          transmission_time: headers.get("paypal-transmission-time"),
          webhook_id: this.webhookId,
          webhook_event: webhookEvent,
        }),
      });

      if (!res.ok) return { verified: false };
      const result = await res.json();
      if (result.verification_status !== "SUCCESS") return { verified: false };

      if (webhookEvent.event_type !== "CHECKOUT.ORDER.APPROVED" && webhookEvent.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
        return { verified: false };
      }

      const resource = webhookEvent.resource;
      return {
        verified: true,
        externalTransactionId: resource?.id ?? webhookEvent.id,
        status: "completed",
        amount: resource?.amount?.value ? Number(resource.amount.value) : undefined,
        currency: resource?.amount?.currency_code,
      };
    } catch {
      return { verified: false };
    }
  }
}
