import type {
  FootballProvider, NormalizedFixture, NormalizedStandingRow, NormalizedTopScorer, FixtureStatus,
} from "@/lib/football/types";

const BASE_URL = "https://api.football-data.org/v4";

const STATUS_MAP: Record<string, FixtureStatus> = {
  SCHEDULED: "scheduled", TIMED: "scheduled",
  IN_PLAY: "live", PAUSED: "live",
  FINISHED: "finished",
  POSTPONED: "postponed",
  SUSPENDED: "cancelled", CANCELLED: "cancelled", AWARDED: "cancelled",
};

function mapFixture(raw: any): NormalizedFixture {
  return {
    id: String(raw.id),
    leagueId: String(raw.competition?.id ?? ""),
    leagueName: raw.competition?.name ?? "",
    leagueLogoUrl: raw.competition?.emblem,
    homeTeam: { id: String(raw.homeTeam?.id ?? ""), name: raw.homeTeam?.name ?? "Home", logoUrl: raw.homeTeam?.crest },
    awayTeam: { id: String(raw.awayTeam?.id ?? ""), name: raw.awayTeam?.name ?? "Away", logoUrl: raw.awayTeam?.crest },
    homeScore: raw.score?.fullTime?.home ?? null,
    awayScore: raw.score?.fullTime?.away ?? null,
    status: STATUS_MAP[raw.status] ?? "scheduled",
    minute: raw.minute ?? null,
    kickoff: raw.utcDate,
  };
}

// football-data.org's free tier is generous on rate limits but limited on
// which competitions/endpoints are included — verify your plan covers the
// competitions you configure in Featured Leagues before relying on this
// as your primary provider. See https://www.football-data.org/documentation/quickstart.
export class FootballDataOrgProvider implements FootballProvider {
  readonly id = "football_data_org";
  readonly name = "Football-Data.org";

  constructor(private apiKey: string) {}

  private async request(path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "X-Auth-Token": this.apiKey },
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`Football-Data.org request failed (${res.status})`);
    return res.json();
  }

  async getLiveFixtures(): Promise<NormalizedFixture[]> {
    const data = await this.request("/matches?status=LIVE,PAUSED");
    return (data.matches ?? []).map(mapFixture);
  }

  async getFixturesByDate(isoDate: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/matches?dateFrom=${isoDate}&dateTo=${isoDate}`);
    return (data.matches ?? []).map(mapFixture);
  }

  async getFixtureById(fixtureId: string): Promise<import("@/lib/football/types").NormalizedFixture | null> {
    const data = await this.request(`/matches/${fixtureId}`);
    return data ? mapFixture(data) : null;
  }

  async getTeamFixtures(teamId: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/teams/${teamId}/matches?limit=6`);
    return (data.matches ?? []).map(mapFixture);
  }

  async getStandings(leagueId: string): Promise<NormalizedStandingRow[]> {
    // football-data.org standings are per-competition (leagueId here),
    // season is implied by the competition's current season — the API
    // doesn't take a separate season parameter.
    const data = await this.request(`/competitions/${leagueId}/standings`);
    const table = data.standings?.find((s: any) => s.type === "TOTAL")?.table ?? [];
    return table.map((row: any) => ({
      position: row.position,
      team: { id: String(row.team.id), name: row.team.name, logoUrl: row.team.crest },
      played: row.playedGames,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
    }));
  }

  async getTopScorers(leagueId: string): Promise<NormalizedTopScorer[]> {
    const data = await this.request(`/competitions/${leagueId}/scorers`);
    return (data.scorers ?? []).map((row: any) => ({
      playerId: String(row.player.id),
      playerName: row.player.name,
      teamName: row.team?.name ?? "",
      teamLogoUrl: row.team?.crest,
      goals: row.goals ?? 0,
      assists: row.assists ?? undefined,
    }));
  }
}
