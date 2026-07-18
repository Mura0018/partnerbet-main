import { createAdminClient } from "@/lib/supabaseAdmin";

// Brute-force protection for /api/auth/login.
// login_attempts has no RLS policies for anon/authenticated — only the
// service-role client (used here) can read or write it, so this can never
// be tampered with or read by a normal user.

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;

export type RateLimitResult = { limited: boolean; retryAfterMinutes: number };

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
