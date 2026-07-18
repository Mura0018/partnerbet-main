import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getActiveFootballProvider } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, SectionHeading, EmptyState } from "@/lib/ui/primitives";

async function getTeamData(teamId: string) {
  const provider = await getActiveFootballProvider();
  if (!provider) return { configured: false, fixtures: [] as any[] };
  try {
    const fixtures = await withFootballCache(`team-fixtures:${teamId}`, provider.id, 3600, () => provider.getTeamFixtures(teamId));
    return { configured: true, fixtures: fixtures ?? [] };
  } catch {
    return { configured: true, fixtures: [] as any[] };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { fixtures } = await getTeamData(id);
  const team = fixtures[0]?.homeTeam?.id === id ? fixtures[0]?.homeTeam : fixtures[0]?.awayTeam;
  return { title: team?.name || "Jamoa" };
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { configured, fixtures } = await getTeamData(id);
  const team = fixtures.length > 0 ? (fixtures[0].homeTeam.id === id ? fixtures[0].homeTeam : fixtures[0].awayTeam) : null;

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/football" />
      <Container className="py-14">
        <div className="flex items-center gap-4 mb-8">
          {team?.logoUrl ? (
            <img src={team.logoUrl} alt={team.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"><Users size={24} className="text-muted" /></div>
          )}
          <h1 className="text-[28px] font-extrabold">{team?.name || "Jamoa"}</h1>
        </div>

        <SectionHeading title="So'nggi o'yinlar" />
        {!configured ? (
          <EmptyState message="Hozircha jonli ma'lumot mavjud emas" />
        ) : fixtures.length === 0 ? (
          <EmptyState message="Bu jamoa uchun o'yinlar topilmadi." />
        ) : (
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            {fixtures.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-4 border-b border-white/5 last:border-0">
                <span className="text-[11px] text-muted w-24 shrink-0">{new Date(f.kickoff).toLocaleDateString()}</span>
                <div className="flex-1 flex items-center justify-center gap-3 font-semibold text-[13px]">
                  <span className="text-right flex-1 truncate">{f.homeTeam.name}</span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 font-mono text-[12px] shrink-0">{f.homeScore ?? "-"} : {f.awayScore ?? "-"}</span>
                  <span className="flex-1 truncate">{f.awayTeam.name}</span>
                </div>
                <span className="w-24 shrink-0 text-right text-[11px] text-muted truncate">{f.leagueName}</span>
              </div>
            ))}
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
