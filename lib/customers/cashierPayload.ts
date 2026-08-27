import { createAdminClient } from "@/lib/supabaseAdmin";

type Admin = ReturnType<typeof createAdminClient>;

// Kassa oynasi / skaner uchun mijoz to'plami: mijoz + 1xBet ID lari
// (tasdiqlanmaganlar belgilangan) + so'nggi buyurtmalar + faollik.
// Pul harakati yo'q — faqat o'qish.
export async function loadCustomerPayload(admin: Admin, customerId: string) {
  const { data: customer } = await admin
    .from("customers")
    .select("id, full_name, phone, created_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;

  const { data: accounts } = await admin
    .from("customer_bet_accounts")
    .select("player_id, player_name, is_primary, verified, source")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  const { data: orders } = await admin
    .from("telegram_orders")
    .select("id, type, amount, status, platform, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(15);
  const completed = (orders ?? []).filter((o: any) => o.status === "completed");
  const volume = completed.reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

  return {
    customer: {
      id: (customer as any).id,
      full_name: (customer as any).full_name ?? null,
      phone: (customer as any).phone ?? "—",
      created_at: (customer as any).created_at ?? null,
    },
    accounts: (accounts ?? []).map((a: any) => ({
      player_id: a.player_id,
      player_name: a.player_name ?? null,
      is_primary: !!a.is_primary,
      verified: !!a.verified,
      source: a.source,
    })),
    orders: orders ?? [],
    activity: { volume, orders_count: completed.length },
  };
}
