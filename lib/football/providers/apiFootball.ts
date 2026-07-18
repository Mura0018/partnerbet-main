import type {
  FootballProvider, NormalizedFixture, NormalizedStandingRow, NormalizedTopScorer, FixtureStatus,
} from "@/lib/football/types";

const BASE_URL = "https://v3.football.api-sports.io";

const STATUS_MAP: Record<string, FixtureStatus> = {
  TBD: "scheduled", NS: "scheduled",
  "1H": "live", HT: "live", "2H": "live", ET: "live", P: "live", BT: "live", LIVE: "live",
  FT: "finished", AET: "finished", PEN: "finished",
  PST: "postponed",
  CANC: "cancelled", ABD: "cancelled", AWD: "cancelled", WO: "cancelled",
};

function mapFixture(raw: any): NormalizedFixture {
  return {
    id: String(raw.fixture.id),
    leagueId: String(raw.league.id),
    leagueName: raw.league.name,
    leagueLogoUrl: raw.league.logo,
    homeTeam: { id: String(raw.teams.home.id), name: raw.teams.home.name, logoUrl: raw.teams.home.logo },
    awayTeam: { id: String(raw.teams.away.id), name: raw.teams.away.name, logoUrl: raw.teams.away.logo },
    homeScore: raw.goals.home,
    awayScore: raw.goals.away,
    status: STATUS_MAP[raw.fixture.status?.short] ?? "scheduled",
    minute: raw.fixture.status?.elapsed ?? null,
    kickoff: raw.fixture.date,
  };
}

export class ApiFootballProvider implements FootballProvider {
  readonly id = "api_football";
  readonly name = "API-Football";

  constructor(private apiKey: string) {}

  private async request(path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-apisports-key": this.apiKey },
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`API-Football request failed (${res.status})`);
    return res.json();
  }

  async getLiveFixtures(): Promise<NormalizedFixture[]> {
    const data = await this.request("/fixtures?live=all");
    return (data.response ?? []).map(mapFixture);
  }

  async getFixturesByDate(isoDate: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/fixtures?date=${isoDate}`);
    return (data.response ?? []).map(mapFixture);
  }

  async getFixtureById(fixtureId: string): Promise<import("@/lib/football/types").NormalizedFixture | null> {
    const data = await this.request(`/fixtures?id=${fixtureId}`);
    const raw = data.response?.[0];
    return raw ? mapFixture(raw) : null;
  }

  async getTeamFixtures(teamId: string): Promise<NormalizedFixture[]> {
    const data = await this.request(`/fixtures?team=${teamId}&last=6`);
    return (data.response ?? []).map(mapFixture);
  }

  async getStandings(leagueId: string, season: string): Promise<NormalizedStandingRow[]> {
    const data = await this.request(`/standings?league=${leagueId}&season=${season}`);
    const table = data.response?.[0]?.league?.standings?.[0] ?? [];
    return table.map((row: any) => ({
      position: row.rank,
      team: { id: String(row.team.id), name: row.team.name, logoUrl: row.team.logo },
      played: row.all.played,
      won: row.all.win,
      drawn: row.all.draw,
      lost: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      points: row.points,
    }));
  }

  async getTopScorers(leagueId: string, season: string): Promise<NormalizedTopScorer[]> {
    const data = await this.request(`/players/topscorers?league=${leagueId}&season=${season}`);
    return (data.response ?? []).map((row: any) => ({
      playerId: String(row.player.id),
      playerName: row.player.name,
      teamName: row.statistics?.[0]?.team?.name ?? "",
      teamLogoUrl: row.statistics?.[0]?.team?.logo,
      goals: row.statistics?.[0]?.goals?.total ?? 0,
      assists: row.statistics?.[0]?.goals?.assists ?? undefined,
    }));
  }
}
