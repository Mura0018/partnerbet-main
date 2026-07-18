import { createAdminClient } from "@/lib/supabaseAdmin";

// Cache-aside wrapper used by every Football Center data fetch:
//   1. Fresh cache exists → return it (no provider call at all).
//   2. No fresh cache → call the provider.
//        - Success → cache the result, return it.
//        - Failure (provider down / rate-limited / network error) →
//          fall back to STALE cache if any exists, rather than showing
//          an error. Only returns null if there is truly no data at all
//          (first-ever request AND the provider is currently failing).
// This is what lets the Football Center survive a provider outage or
// quota exhaustion gracefully, and is also what a future "try provider A,
// then provider B" failover strategy would build on top of — without
// touching any of the call sites below.
export async function withFootballCache<T>(
  cacheKey: string,
  providerId: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T | null> {
  const supabase = createAdminClient();
  const { data: cached } = await supabase.from("football_cache").select("*").eq("cache_key", cacheKey).maybeSingle();
  const now = new Date();

  if (cached && new Date(cached.expires_at) > now) {
    return cached.data as T;
  }

  try {
    const fresh = await fetcher();
    await supabase.from("football_cache").upsert(
      {
        cache_key: cacheKey,
        provider: providerId,
        data: fresh as any,
        cached_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "cache_key" }
    );
    return fresh;
  } catch {
    if (cached) return cached.data as T; // serve stale data rather than nothing
    return null;
  }
}
