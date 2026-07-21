import { createAdminClient } from "@/lib/supabaseAdmin";
import { notifySecurityAlert } from "@/lib/telegram/notifySecurity";

// Brute-force protection for /api/auth/login.
// login_attempts has no RLS policies for anon/authenticated — only the
// service-role client (used here) can read or write it, so this can never
// be tampered with or read by a normal user.

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const AUTO_BLOCK_HOURS = 24;

export type RateLimitResult = { limited: boolean; retryAfterMinutes: number };

async function isStaffEmail(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).some((u) => u.email?.toLowerCase() === email.toLowerCase());
}

// Once an IP crosses the per-IP failure threshold, this doesn't just wait
// out the rolling window (which would let the attacker resume in 15
// minutes) — it adds the IP to blocked_ips for 24h, so the block persists
// independently of how the rolling window ages. A manual block from the
// security log (expires_at left null) is never touched here.
async function autoBlockIp(ip: string, failureCount: number) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: existing } = await admin.from("blocked_ips").select("expires_at").eq("ip_address", ip).maybeSingle();
  const alreadyActivelyBlocked = existing && (!existing.expires_at || existing.expires_at > nowIso);
  if (alreadyActivelyBlocked) return;

  const expiresAt = new Date(Date.now() + AUTO_BLOCK_HOURS * 60 * 60 * 1000).toISOString();
  await admin.from("blocked_ips").upsert(
    {
      ip_address: ip,
      reason: `Avtomatik: ${WINDOW_MINUTES} daqiqada ${failureCount} marta xato urinish`,
      blocked_by: null,
      blocked_at: nowIso,
      expires_at: expiresAt,
    },
    { onConflict: "ip_address" }
  );

  await notifySecurityAlert({
    title: `IP avtomatik bloklandi (${AUTO_BLOCK_HOURS} soatga)`,
    detail: `Bu manzildan ${WINDOW_MINUTES} daqiqada ${failureCount} marta xato parol kiritildi.`,
    ip,
    dedupeKey: `ip-block:${ip}`,
  });
}

async function alertTargetedStaffAccount(identifier: string, failureCount: number) {
  const targeted = await isStaffEmail(identifier);
  if (!targeted) return;
  await notifySecurityAlert({
    title: "Hisobingiz nishonga olinmoqda",
    detail: `"${identifier}" hisobiga ${WINDOW_MINUTES} daqiqada ${failureCount} marta noto'g'ri parol kiritildi.`,
    dedupeKey: `staff-target:${identifier}`,
  });
}

export async function checkLoginRateLimit(identifier: string, ip: string | null): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const [byEmail, byIp] = await Promise.all([
    supabase
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("success", false)
      .gte("created_at", since),
    ip
      ? supabase
          .from("login_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .eq("success", false)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);

  const emailCount = byEmail.count ?? 0;
  const ipCount = (byIp as any).count ?? 0;

  // Fire-and-forget side effects — never let an alert failure block login.
  if (ip && ipCount >= MAX_ATTEMPTS_PER_IP) {
    autoBlockIp(ip, ipCount).catch(() => {});
  }
  if (emailCount >= MAX_ATTEMPTS_PER_EMAIL) {
    alertTargetedStaffAccount(identifier, emailCount).catch(() => {});
  }

  if (emailCount >= MAX_ATTEMPTS_PER_EMAIL || ipCount >= MAX_ATTEMPTS_PER_IP) {
    return { limited: true, retryAfterMinutes: WINDOW_MINUTES };
  }
  return { limited: false, retryAfterMinutes: 0 };
}

export async function recordLoginAttempt(
  identifier: string,
  ip: string | null,
  userAgent: string | null,
  success: boolean
) {
  const supabase = createAdminClient();
  await supabase.from("login_attempts").insert({
    identifier,
    ip_address: ip,
    user_agent: userAgent,
    success,
  });
}
