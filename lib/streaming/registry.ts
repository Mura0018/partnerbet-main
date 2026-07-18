import { createAdminClient } from "@/lib/supabaseAdmin";
import { getProviderCredential } from "@/lib/streaming/credentials";
import { GenericRestStreamingProvider } from "@/lib/streaming/providers/genericRestProvider";
import type { StreamingProvider } from "@/lib/streaming/types";

// Returns null (never throws) when a provider row can't be resolved into
// a working adapter — callers must treat that as "no stream available",
// not as an error.
export async function getStreamingProviderById(providerId: string): Promise<StreamingProvider | null> {
  const supabase = createAdminClient();
  const { data: provider } = await supabase
    .from("streaming_providers")
    .select("id, name, base_api_url, is_active")
    .eq("id", providerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!provider || !provider.is_active) return null;

  const [apiKey, apiSecret] = await Promise.all([
    getProviderCredential(provider.id, "api_key"),
    getProviderCredential(provider.id, "api_secret"),
  ]);

  // A future named provider with a non-standard API would branch here on
  // provider.key instead of always returning the generic adapter — see
  // LIVE_STREAMING_ARCHITECTURE.md.
  return new GenericRestStreamingProvider({
    id: provider.id,
    name: provider.name,
    baseApiUrl: provider.base_api_url,
    apiKey,
    apiSecret,
  });
}
