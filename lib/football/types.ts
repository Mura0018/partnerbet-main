// Normalized football data shapes. Every provider adapter (API-Football,
// Sportmonks, Football-Data.org, or any future provider) translates its
// own response format INTO these shapes. Nothing outside lib/football/
// ever sees a provider-specific field name — this is what makes switching
// providers a config change instead of a rewrite.

export type FixtureStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export type NormalizedTeam = {
  id: string;
  name: string;
  logoUrl?: string;
};

export type NormalizedFixture = {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueLogoUrl?: string;
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  homeScore: number | null;
  awayScore: number | null;
  status: FixtureStatus;
  minute: number | null;
  kickoff: string; // ISO 8601
};

export type NormalizedStandingRow = {
  position: number;
  team: NormalizedTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type NormalizedTopScorer = {
  playerId: string;
  playerName: string;
  teamName: string;
  teamLogoUrl?: string;
  goals: number;
  assists?: number;
};

// Every provider adapter implements exactly this contract. The rest of
// the app (routes, admin UI, Football Center pages) only ever talks to
// this interface — never to a provider's raw SDK/HTTP shape directly.
export interface FootballProvider {
  readonly id: string; // e.g. "api_football" — must match the site_settings.football_provider.active value
  readonly name: string; // human-readable, shown in the admin provider picker

  getLiveFixtures(): Promise<NormalizedFixture[]>;
  getFixturesByDate(isoDate: string): Promise<NormalizedFixture[]>;
  getFixtureById(fixtureId: string): Promise<NormalizedFixture | null>;
  getTeamFixtures(teamId: string): Promise<NormalizedFixture[]>;
  getStandings(leagueId: string, season: string): Promise<NormalizedStandingRow[]>;
  getTopScorers(leagueId: string, season: string): Promise<NormalizedTopScorer[]>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No football data provider is configured yet.");
    this.name = "ProviderNotConfiguredError";
  }
}
