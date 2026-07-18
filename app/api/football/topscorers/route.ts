import { NextRequest, NextResponse } from "next/server";
import { getActiveFootballProvider, getFootballProviderConfig } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";

export async function GET(req: NextRequest) {
  const provider = await getActiveFootballProvider();
  if (!provider) {
    return NextResponse.json({ configured: false, topScorers: [] });
  }

  const config = await getFootballProviderConfig();
  const { searchParams } = new URL(req.url);
  const league = searchParams.get("league") ?? config.defaultLeagueId;
  const season = searchParams.get("season") ?? config.defaultSeason;

  if (!league) {
    return NextResponse.json({ configured: true, topScorers: [], error: "no_league_selected" });
  }

  try {
    const topScorers = await withFootballCache(
      `topscorers:${league}:${season}`,
      provider.id,
      3600,
      () => provider.getTopScorers(league, season)
    );
    return NextResponse.json({ configured: true, topScorers: topScorers ?? [] });
  } catch {
    return NextResponse.json({ configured: true, topScorers: [], error: "provider_error" });
  }
}
