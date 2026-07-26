import { createAdminClient } from "@/lib/supabaseAdmin";

// W1.3 — ketma-ket to'lovsiz (expired) buyurtma ochgan mijoz vaqtincha
// bloklanadi (customers.blocked_until, /api/cron/expire-stale-orders
// tomonidan o'rnatiladi). Buyurtma yaratishdan OLDIN shu tekshiruv
// chaqiriladi (orders/route.ts va withdraw/payout/route.ts — ikkalasi
// ham haqiqiy buyurtma/pul harakatini boshlaydi).
export async function checkCustomerBlocked(customerId: string): Promise<{ blocked: boolean; until: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("blocked_until").eq("id", customerId).maybeSingle();
  const until = (data as any)?.blocked_until ?? null;
  if (until && new Date(until).getTime() > Date.now()) {
    return { blocked: true, until };
  }
  return { blocked: false, until: null };
}
