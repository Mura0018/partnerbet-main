import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/notify";

const SECURITY_LOG_URL = "https://www.couponbet.org/admin/security-log";

// Prevents a sustained attack from sending one Telegram message per failed
// request — each distinct situation (a given IP, a given targeted staff
// account) only re-alerts after the cooldown window has passed.
async function shouldAlert(key: string, cooldownMinutes: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("security_alert_state").select("last_sent_at").eq("alert_key", key).maybeSingle();
  if (data && Date.now() - new Date(data.last_sent_at).getTime() < cooldownMinutes * 60 * 1000) {
    return false;
  }
  await admin.from("security_alert_state").upsert({ alert_key: key, last_sent_at: new Date().toISOString() }, { onConflict: "alert_key" });
  return true;
}

// Notifies every active staff member who has linked their Telegram —
// not just super_admin — because the whole team should know something
// is happening. Only super_admin's copy links to the security log
// itself (they're the only ones who can view/act on it); everyone
// else's copy just says to tell their boss.
export async function notifySecurityAlert(opts: {
  title: string;
  detail: string;
  ip?: string;
  dedupeKey: string;
  cooldownMinutes?: number;
}): Promise<void> {
  const allowed = await shouldAlert(opts.dedupeKey, opts.cooldownMinutes ?? 30);
  if (!allowed) return;

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("profiles")
    .select("telegram_chat_id, roles(key)")
    .eq("is_active", true)
    .not("telegram_chat_id", "is", null);

  const ipLine = opts.ip ? `\nIP: ${opts.ip}` : "";

  await Promise.all(
    (staff ?? []).map((s: any) => {
      if (!s.telegram_chat_id) return Promise.resolve();
      const isSuperAdmin = s.roles?.key === "super_admin";
      const text = isSuperAdmin
        ? `🔴 XAVFSIZLIK OGOHLANTIRISHI\n\n${opts.title}\n${opts.detail}${ipLine}\n\nXavfsizlik jurnalini tekshiring: ${SECURITY_LOG_URL}`
        : `🔴 XAVFSIZLIK OGOHLANTIRISHI\n\n${opts.title}\n${opts.detail}\n\nBoshliqqa xabar bering.`;
      return sendTelegramMessage(s.telegram_chat_id, text, undefined);
    })
  );
}
