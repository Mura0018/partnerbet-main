import webpush from "web-push";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getApiCredential } from "@/lib/auth/apiCredentials";

export type SendPushResult = { recipients: number; failures: number };

// Broadcasts a notification to every stored subscription. Expired/invalid
// subscriptions (HTTP 404/410 from the push service — the browser
// unsubscribed or the endpoint died) are removed automatically so the
// subscriber list stays clean without manual admin cleanup.
export async function sendPushToAllSubscribers(title: string, body: string, url?: string): Promise<SendPushResult> {
  const publicKey = await getApiCredential("push_vapid_public_key");
  const privateKey = await getApiCredential("push_vapid_private_key");

  if (!publicKey || !privateKey) {
    throw new Error("VAPID kalitlari sozlanmagan (Sozlamalar > API kalitlar).");
  }

  webpush.setVapidDetails("mailto:support@couponbet.org", publicKey, privateKey);

  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase.from("push_subscriptions").select("*");

  let recipients = 0;
  let failures = 0;
  const payload = JSON.stringify({ title, body, url: url || "/" });

  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      recipients += 1;
    } catch (err: any) {
      failures += 1;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { recipients, failures };
}
