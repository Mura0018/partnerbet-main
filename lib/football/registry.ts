import { createAdminClient } from "@/lib/supabaseAdmin";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { ApiFootballProvider } from "@/lib/football/providers/apiFootball";
import { SportmonksProvider } from "@/lib/football/providers/sportmonks";
import { FootballDataOrgProvider } from "@/lib/football/providers/footballDataOrg";
import type { FootballProvider } from "@/lib/football/types";

// Maps a provider id (stored in site_settings.football_provider.active)
// to the secure credential key (api_credentials.key) it needs, and the
// class that implements it. Adding a future provider is exactly ONE new
// entry here plus one new file in lib/football/providers/ — nothing else
// in the application changes.
const PROVIDER_REGISTRY: Record<string, { credentialKey: string; create: (apiKey: string) => FootballProvider }> = {
  api_football: { credentialKey: "football_api_key", create: (key) => new ApiFootballProvider(key) },
  sportmonks: { credentialKey: "sportmonks_api_key", create: (key) => new SportmonksProvider(key) },
  football_data_org: { credentialKey: "footballdata_org_api_key", create: (key) => new FootballDataOrgProvider(key) },
};

export const AVAILABLE_PROVIDERS = Object.entries(PROVIDER_REGISTRY).map(([id, cfg]) => ({
  id,
  credentialKey: cfg.credentialKey,
}));

export type FootballProviderConfig = {
  active: string | null;
  defaultLeagueId: string;
  defaultSeason: string;
};

export async function getFootballProviderConfig(): Promise<FootballProviderConfig> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "football_provider").maybeSingle();
  const value = (data?.value as any) ?? {};
  return {
    active: value.active ?? null,
    defaultLeagueId: value.default_league_id ?? "",
    defaultSeason: value.default_season ?? "",
  };
}

// Returns null (never throws) when no provider is configured — callers
// must treat that as "show a graceful empty state", not an error.
export async function getActiveFootballProvider(): Promise<FootballProvider | null> {
  const config = await getFootballProviderConfig();
  if (!config.active) return null;

  const entry = PROVIDER_REGISTRY[config.active];
  if (!entry) return null; // configured provider id no longer registered (e.g. renamed) — fail gracefully

  const apiKey = await getApiCredential(entry.credentialKey);
  if (!apiKey) return null; // provider selected but key not yet entered — fail gracefully

  return entry.create(apiKey);
}
