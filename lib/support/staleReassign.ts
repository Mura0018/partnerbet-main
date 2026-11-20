import { createAdminClient } from "@/lib/supabaseAdmin";
import { isEffectivelyOnline, withPresenceFallback } from "@/lib/presence";

const REASSIGN_OFFLINE_GRACE_MINUTES = 10;

const STALE_MINUTES = 15;

export async function reassignStaleThread(customerId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: thread } = await supabase
    .from("telegram_support_threads")
    .select("claimed_by, last_operator_reply_at, last_customer_message_at, status, is_archived")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!thread || thread.is_archived || thread.status === "ended") return false;
  if (!thread.claimed_by) return false;

  // Haqiqiy onlayn (is_online + heartbeat, 0106) — lib/presence.ts.
  const op = await withPresenceFallback<{ is_online: boolean | null; last_seen_at?: string | null }>(
    () => supabase.from("profiles").select("is_online, last_seen_at").eq("id", thread.claimed_by).maybeSingle(),
    () => supabase.from("profiles").select("is_online").eq("id", thread.claimed_by).maybeSingle()
  );

  const now = Date.now();
  const lastReply = thread.last_operator_reply_at ? new Date(thread.last_operator_reply_at).getTime() : 0;
  const lastCustomer = thread.last_customer_message_at ? new Date(thread.last_customer_message_at).getTime() : 0;

  const waitedMs = now - Math.max(lastCustomer, lastReply);
  const isStale = lastCustomer > lastReply && waitedMs > STALE_MINUTES * 60 * 1000;
  // Egalikni olib qo'yish uchun kengroq muhlat (10 daq): telefon qulflanishi /
  // ilova almashishida JS to'xtaydi — qisqa uzilish suhbatni olib qo'ymasin.
  const operatorOffline = op ? !isEffectivelyOnline(op, now, REASSIGN_OFFLINE_GRACE_MINUTES) : true;

  if (operatorOffline || isStale) {
    await supabase.from("telegram_support_threads").update({
      claimed_by: null,
      claimed_at: null,
      updated_at: new Date().toISOString(),
    }).eq("customer_id", customerId);
    return true;
  }
  return false;
}
