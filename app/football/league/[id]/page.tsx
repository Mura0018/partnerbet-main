import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { getActiveFootballProvider } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, SectionHeading, EmptyState } from "@/lib/ui/primitives";

async function getLeague(id: string) {
  const supabase = createPublicServerClient();
  const { data } = await supabase.from("featured_leagues").select("*").eq("id", id).eq("is_active", true).maybeSingle();
  return data;
}

async function getLeagueData(externalLeagueId: string, season: string) {
  const provider = await getActiveFootballProvider();
  if (!provider) return { configured: false, standings: [] as any[], topScorers: [] as any[] };
  try {
    const [standings, topScorers] = await Promise.all([
      withFootballCache(`standings:${externalLeagueId}:${season}`, provider.id, 3600, () => provider.getStandings(externalLeagueId, season)),
      withFootballCache(`topscorers:${externalLeagueId}:${season}`, provider.id, 3600, () => provider.getTopScorers(externalLeagueId, season)),
    ]);
    return { configured: true, standings: standings ?? [], topScorers: topScorers ?? [] };
  } catch {
    return { configured: true, standings: [] as any[], topScorers: [] as any[] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const league = await getLeague(id);
  return { title: league?.name || "Liga" };
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await getLeague(id);
  if (!league) notFound();

  const { configured, standings, topScorers } = await getLeagueData(league.external_league_id, league.season);

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/football" />
      <Container className="py-14">
        <div className="flex items-center gap-4 mb-8">
          {league.logo_url ? (
            <img src={league.logo_url} alt={league.name} className="w-14 h-14 rounded-xl object-cover border border-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Trophy size={22} className="text-vip" /></div>
          )}
          <div>
            <h1 className="text-[28px] font-extrabold">{league.name}</h1>
            <p className="text-[13px] text-muted">{league.country} {league.season && `· ${league.season}`}</p>
          </div>
        </div>

        {!configured || standings.length === 0 ? (
          <EmptyState message="Hozircha jonli ma'lumot mavjud emas" />
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <SectionHeading title="Turnir jadvali" />
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-white/[0.03] text-[10px] text-muted uppercase">
                    <tr><th className="text-left px-4 py-3">#</th><th className="text-left px-4 py-3">Jamoa</th><th className="px-2 py-3">O</th><th className="px-2 py-3">G</th><th className="px-2 py-3">D</th><th className="px-2 py-3">M</th><th className="px-4 py-3">Ochko</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {standings.map((row: any) => (
                      <tr key={row.team.id}>
                        <td className="px-4 py-3">{row.position}</td>
                        <td className="px-4 py-3 font-medium">
                          <a href={`/football/team/${row.team.id}`} className="hover:text-accent transition-colors">{row.team.name}</a>
                        </td>
                        <td className="px-2 py-3 text-center text-muted">{row.played}</td>
                        <td className="px-2 py-3 text-center text-muted">{row.won}</td>
                        <td className="px-2 py-3 text-center text-muted">{row.drawn}</td>
                        <td className="px-2 py-3 text-center text-muted">{row.lost}</td>
                        <td className="px-4 py-3 text-center font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <SectionHeading title="Top Scorers" />
              <div className="rounded-2xl border border-white/8 p-4">
                {topScorers.length === 0 ? (
                  <p className="text-[12px] text-muted">Ma'lumot yo'q</p>
                ) : (
                  <div className="space-y-2.5">
                    {topScorers.slice(0, 10).map((p: any, i: number) => (
                      <div key={p.playerId} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-2 truncate"><span className="text-muted w-4">{i + 1}</span>{p.playerName}</span>
                        <span className="font-bold shrink-0 ml-2">{p.goals}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
