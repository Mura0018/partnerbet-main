// Payment gateway provider abstraction — mirrors lib/streaming/types.ts
// (v1.1.0) and lib/football/types.ts (Phase 3c) in shape. Crypto payment
// methods do NOT use this interface at all (see DONATION_SYSTEM.md for
// why): they're a simple "display wallet address + QR code" flow with no
// API integration, so there is nothing to adapt.

export type CheckoutSessionResult =
  | { success: true; checkoutUrl: string; externalSessionId: string }
  | { success: false; error: string };

export type WebhookVerificationResult =
  | { verified: false }
  | {
      verified: true;
      externalTransactionId: string;
      status: "completed" | "failed";
      amount?: number;
      currency?: string;
    };

export interface PaymentGatewayProvider {
  readonly key: string;
  readonly name: string;

  createCheckoutSession(params: {
    donationId: string;
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;

  // rawBody must be the UNPARSED request body — signature verification
  // for both Stripe and PayPal depends on the exact raw bytes.
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult>;
}
