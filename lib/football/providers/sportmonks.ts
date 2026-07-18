import type {
  FootballProvider, NormalizedFixture, NormalizedStandingRow, NormalizedTopScorer, FixtureStatus,
} from "@/lib/football/types";

// NOTE: Sportmonks' v3 API response shape depends heavily on which
// "includes" are requested and can evolve between API versions. The field
// mappings below reflect Sportmonks' documented v3 structure at the time
// of writing — verify against https://docs.sportmonks.com before relying
// on this in production, and adjust the `includes` query params / mapping
// if their schema has changed since.
const BASE_URL = "https://api.sportmonks.com/v3/football";

const STATE_MAP: Record<string, FixtureStatus> = {
  NS: "scheduled",
  LIVE: "live", HT: "live", INPLAY_1ST_HALF: "live", INPLAY_2ND_HALF: "live", ET: "live",
  FT: "finished", AET: "finished", FT_PEN: "finished",
  POSTP: "postponed",
  CANCL: "cancelled", ABAN: "cancelled",
};

function mapFixture(raw: any): NormalizedFixture {
  const home = raw.participants?.find((p: any) => p.meta?.location === "home") ?? raw.participants?.[0];
  const away = raw.participants?.find((p: any) => p.meta?.location === "away") ?? raw.participants?.[1];
  const homeScore = raw.scores?.find((s: any) => s.description === "CURRENT" && s.score?.participant === "home")?.score?.goals ?? null;
  const awayScore = raw.scores?.find((s: any) => s.description === "CURRENT" && s.score?.participant === "away")?.score?.goals ?? null;

  return {
    id: String(raw.id),
    leagueId: String(raw.league_id ?? raw.league?.id ?? ""),
    leagueName: raw.league?.name ?? "",
    leagueLogoUrl: raw.league?.image_path,
    homeTeam: { id: String(home?.id ?? ""), name: home?.name ?? "Home", logoUrl: home?.image_path },
    awayTeam: { id: String(away?.id ?? ""), name: away?.name ?? "Away", logoUrl: away?.image_path },
    homeScore,
    awayScore,
    status: STATE_MAP[raw.state?.short_name] ?? "scheduled",
    minute: raw.periods?.find((p: any) => p.ticking)?.minutes ?? null,
    kickoff: raw.starting_at,
  };
}

export class SportmonksProvider implements FootballProvider {
  readonly id = "sportmonks";
  readonly name = "Sportmonks";

  constructor(private apiKey: string) {}

  private async request(path: string): Promise<any> {
    const separator = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE_URL}${path}${separator}api_token=${this.apiKey}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`Sportmonks request failed (${res.status})`);
    return res.json();
  }

  async getLiveFixtures(): Promise<NormalizedFixture[]> {
    const data = await this.request("/livescores?include=participants;scores;state;periods;league");
    return (data.data ?? []).map(mapFixture);
  }

  async getFixturesByDate(isoDate: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/fixtures/date/${isoDate}?include=participants;scores;state;league`);
    return (data.data ?? []).map(mapFixture);
  }

  async getFixtureById(fixtureId: string): Promise<import("@/lib/football/types").NormalizedFixture | null> {
    const data = await this.request(`/fixtures/${fixtureId}?include=participants;scores;state;periods;league`);
    return data.data ? mapFixture(data.data) : null;
  }

  async getTeamFixtures(teamId: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/fixtures?filters=participantId:${teamId}&include=participants;scores;state;league&sort=-starting_at`);
    return (data.data ?? []).slice(0, 6).map(mapFixture);
  }

  async getStandings(leagueId: string, season: string): Promise<NormalizedStandingRow[]> {
    // Sportmonks standings are keyed by season ID, not league+year — the
    // caller (lib/football/registry.ts) is expected to pass whichever ID
    // the admin has configured as the "season" for this provider.
    const data = await this.request(`/standings/season/${season}?include=participant`);
    return (data.data ?? []).map((row: any) => ({
      position: row.position,
      team: { id: String(row.participant?.id ?? ""), name: row.participant?.name ?? "", logoUrl: row.participant?.image_path },
      played: row.details?.played ?? 0,
      won: row.details?.won ?? 0,
      drawn: row.details?.draw ?? 0,
      lost: row.details?.lost ?? 0,
      goalsFor: row.details?.goals_for ?? 0,
      goalsAgainst: row.details?.goals_against ?? 0,
      points: row.points ?? 0,
    }));
  }

  async getTopScorers(leagueId: string, season: string): Promise<NormalizedTopScorer[]> {
    const data = await this.request(`/topscorers/season/${season}?include=player;participant`);
    return (data.data ?? []).map((row: any) => ({
      playerId: String(row.player?.id ?? ""),
      playerName: row.player?.name ?? "",
      teamName: row.participant?.name ?? "",
      teamLogoUrl: row.participant?.image_path,
      goals: row.total ?? 0,
    }));
  }
}
