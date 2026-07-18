import { createAdminClient } from "@/lib/supabaseAdmin";

// Generic, reusable rate limiter for public write endpoints that don't
// have a natural domain table to count against (login has login_attempts,
// streaming test-connection has streaming_connection_logs, donations
// checkout counts the donations table itself — those are left as-is).
// This covers everything else: view-count tracking, promo-code usage
// tracking, push subscribe/unsubscribe.
export async function checkAndRecordRateLimit(
  bucket: string,
  windowSeconds: number,
  maxEvents: number
): Promise<{ allowed: boolean }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);

  if ((count ?? 0) >= maxEvents) {
    return { allowed: false };
  }

  await admin.from("rate_limit_events").insert({ bucket });
  return { allowed: true };
}

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown";
}
