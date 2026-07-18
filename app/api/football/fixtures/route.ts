import { NextRequest, NextResponse } from "next/server";
import { getActiveFootballProvider } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";

// Provider-agnostic — works with whichever provider the admin has
// configured (Site Settings / Football Center). Returns a graceful empty
// state instead of an error when no provider is set up yet.
export async function GET(req: NextRequest) {
  const provider = await getActiveFootballProvider();
  if (!provider) {
    return NextResponse.json({ configured: false, fixtures: [] });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    const fixtures = await withFootballCache(
      date ? `fixtures:date:${date}` : "fixtures:live",
      provider.id,
      date ? 300 : 30, // live scores refresh often; a specific day's fixtures change rarely
      () => (date ? provider.getFixturesByDate(date) : provider.getLiveFixtures())
    );
    return NextResponse.json({ configured: true, provider: provider.id, fixtures: fixtures ?? [] });
  } catch {
    return NextResponse.json({ configured: true, fixtures: [], error: "provider_error" });
  }
}
