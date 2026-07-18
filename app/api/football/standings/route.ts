import { NextRequest, NextResponse } from "next/server";
import { getActiveFootballProvider, getFootballProviderConfig } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";

export async function GET(req: NextRequest) {
  const provider = await getActiveFootballProvider();
  if (!provider) {
    return NextResponse.json({ configured: false, standings: [] });
  }

  const config = await getFootballProviderConfig();
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league") ?? config.defaultLeagueId;
  const season = searchParams.get("season") ?? config.defaultSeason;

  if (!league) {
    return NextResponse.json({ configured: true, standings: [], error: "no_league_selected" });
  }

  try {
    const standings = await withFootballCache(
      `standings:${league}:${season}`,
      provider.id,
      3600,
      () => provider.getStandings(league, season)
    );
    return NextResponse.json({ configured: true, standings: standings ?? [] });
  } catch {
    return NextResponse.json({ configured: true, standings: [], error: "provider_error" });
  }
}
