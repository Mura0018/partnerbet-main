import { createAdminClient } from "@/lib/supabaseAdmin";

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

  const { data: op } = await supabase
    .from("profiles")
    .select("is_online")
    .eq("id", thread.claimed_by)
    .maybeSingle();

  const now = Date.now();
  const lastReply = thread.last_operator_reply_at ? new Date(thread.last_operator_reply_at).getTime() : 0;
  const lastCustomer = thread.last_customer_message_at ? new Date(thread.last_customer_message_at).getTime() : 0;

  const waitedMs = now - Math.max(lastCustomer, lastReply);
  const isStale = lastCustomer > lastReply && waitedMs > STALE_MINUTES * 60 * 1000;
  const operatorOffline = op ? !op.is_online : true;

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
