import { createAdminClient } from "@/lib/supabaseAdmin";
import { getPaymentMethodCredential } from "@/lib/donations/credentials";
import { StripeProvider } from "@/lib/donations/providers/stripeProvider";
import { PayPalProvider } from "@/lib/donations/providers/paypalProvider";
import { GenericPaymentProvider } from "@/lib/donations/providers/genericProvider";
import type { PaymentGatewayProvider } from "@/lib/donations/types";

// Maps a payment_methods.provider_key to its adapter. Adding a future
// named gateway means one new entry here and one new file in
// lib/donations/providers/ — nothing else in the app changes (same
// extensibility pattern as Football Data and Live Streaming).
export async function getPaymentGatewayProvider(paymentMethodId: string): Promise<PaymentGatewayProvider | null> {
  const supabase = createAdminClient();
  const { data: method } = await supabase
    .from("payment_methods")
    .select("id, name, provider_key, base_api_url, method_type, is_active")
    .eq("id", paymentMethodId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!method || !method.is_active || method.method_type !== "gateway") return null;

  if (method.provider_key === "stripe") {
    const secretKey = await getPaymentMethodCredential(method.id, "secret_key");
    if (!secretKey) return null;
    const webhookSecret = await getPaymentMethodCredential(method.id, "webhook_secret");
    return new StripeProvider(secretKey, webhookSecret);
  }

  if (method.provider_key === "paypal") {
    const clientId = await getPaymentMethodCredential(method.id, "client_id");
    const clientSecret = await getPaymentMethodCredential(method.id, "client_secret");
    if (!clientId || !clientSecret) return null;
    const webhookId = await getPaymentMethodCredential(method.id, "webhook_id");
    return new PayPalProvider(clientId, clientSecret, webhookId);
  }

  if (method.provider_key === "generic") {
    if (!method.base_api_url) return null;
    const apiKey = await getPaymentMethodCredential(method.id, "api_key");
    if (!apiKey) return null;
    const apiSecret = await getPaymentMethodCredential(method.id, "api_secret");
    return new GenericPaymentProvider(method.base_api_url, apiKey, apiSecret, method.name);
  }

  return null;
}
