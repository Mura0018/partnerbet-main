"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Trophy, Star, Newspaper, Video, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { SectionHeading } from "@/lib/ui/primitives";
import { WatchLiveButton } from "@/lib/streaming/WatchLiveButton";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
      {message}
    </div>
  );
}

function NotConfiguredState() {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-4">
        <Radio size={20} className="text-muted" />
      </div>
      <p className="text-[14px] font-medium text-white mb-1">Hozircha jonli ma'lumot mavjud emas</p>
      <p className="text-[12px] text-muted">Football Center tez orada to'liq ishga tushadi.</p>
    </div>
  );
}

function FixtureRow({ f, footballProvider }: { f: any; footballProvider: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-muted w-20 shrink-0">
        {f.status === "live" ? (
          <span className="text-[#FF6B85] font-semibold">{f.minute ? `${f.minute}'` : "LIVE"}</span>
        ) : f.status === "finished" ? "FT" : new Date(f.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <div className="flex-1 flex items-center justify-center gap-3 font-semibold text-[13px] min-w-0">
        <span className="text-right flex-1 truncate">{f.homeTeam?.name}</span>
        <span className="px-2.5 py-1 rounded-md bg-white/5 font-mono text-[12px] shrink-0">
          {f.homeScore ?? "-"} : {f.awayScore ?? "-"}
        </span>
        <span className="flex-1 truncate">{f.awayTeam?.name}</span>
      </div>
      <span className="w-20 shrink-0 text-right text-[11px] text-muted truncate hidden sm:block">{f.leagueName}</span>
      {footballProvider && <WatchLiveButton footballProvider={footballProvider} externalFixtureId={f.id} />}
    </div>
  );
}

export default function FootballCenterPage() {
  const [liveFixtures, setLiveFixtures] = useState<any[]>([]);
  const [liveConfigured, setLiveConfigured] = useState(true);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);

  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<any | null>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [topScorers, setTopScorers] = useState<any[]>([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const [featuredFixtures, setFeaturedFixtures] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/football/fixtures?live=all");
        const json = await res.json();
        setLiveConfigured(!!json.configured);
        setLiveFixtures(json.fixtures ?? []);
        setActiveProvider(json.provider ?? null);
      } catch {
        setLiveConfigured(false);
      } finally {
        setLoadingLive(false);
      }
    })();

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("featured_leagues").select("*").eq("is_active", true).order("position");
      setLeagues(data ?? []);
      if (data && data.length > 0) setSelectedLeague(data[0]);
    })();

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("featured_fixtures")
        .select("*")
        .eq("is_active", true)
        .order("position")
        .limit(4);
      setFeaturedFixtures(data ?? []);
    })();

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("football_news")
        .select("id, title, slug, excerpt, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(4);
      setNews(data ?? []);
    })();

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("football_videos")
        .select("*")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(4);
      setVideos(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedLeague) return;
    (async () => {
      setLoadingTable(true);
      try {
        const [standingsRes, scorersRes] = await Promise.all([
          fetch(`/api/football/standings?league=${selectedLeague.external_league_id}&season=${selectedLeague.season}`).then((r) => r.json()),
          fetch(`/api/football/topscorers?league=${selectedLeague.external_league_id}&season=${selectedLeague.season}`).then((r) => r.json()),
        ]);
        setStandings(standingsRes.standings ?? []);
        setTopScorers(scorersRes.topScorers ?? []);
      } catch {
        setStandings([]);
        setTopScorers([]);
      } finally {
        setLoadingTable(false);
      }
    })();
  }, [selectedLeague]);

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/football" />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 animate-fade-in-up">
        <h1 className="text-[32px] md:text-[38px] font-extrabold mb-8">Football Center</h1>

        {/* Live Matches */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Radio size={16} className="text-[#FF6B85]" />
            <h2 className="text-[18px] font-bold">Live Matches</h2>
          </div>
          {loadingLive ? (
            <EmptyState message="Yuklanmoqda…" />
          ) : !liveConfigured ? (
            <NotConfiguredState />
          ) : liveFixtures.length === 0 ? (
            <EmptyState message="Hozircha jonli o'yin yo'q." />
          ) : (
            <div className="rounded-xl border border-white/8 overflow-hidden">
              {liveFixtures.slice(0, 8).map((f) => <FixtureRow key={f.id} f={f} footballProvider={activeProvider} />)}
            </div>
          )}
        </section>

        {/* Featured Matches */}
        {featuredFixtures.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-vip" />
              <h2 className="text-[18px] font-bold">Featured Matches</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {featuredFixtures.map((f) => (
                <FeaturedFixtureCard key={f.id} pin={f} />
              ))}
            </div>
          </section>
        )}

        {/* League Tables + Top Scorers */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-accent" />
              <h2 className="text-[18px] font-bold">League Tables</h2>
            </div>
            {leagues.length > 0 && (
              <div className="relative">
                <select
                  value={selectedLeague?.id ?? ""}
                  onChange={(e) => setSelectedLeague(leagues.find((l) => l.id === e.target.value))}
                  className="appearance-none bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-8 text-[12px]"
                >
                  {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              </div>
            )}
          </div>

          {leagues.length === 0 ? (
            <EmptyState message="Hozircha liga tanlanmagan." />
          ) : loadingTable ? (
            <EmptyState message="Yuklanmoqda…" />
          ) : standings.length === 0 ? (
            <NotConfiguredState />
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-white/[0.03] text-[10px] text-muted uppercase">
                      <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Jamoa</th><th className="px-2 py-2">O</th><th className="px-2 py-2">G</th><th className="px-2 py-2">D</th><th className="px-2 py-2">M</th><th className="px-3 py-2">Ochko</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {standings.map((row: any) => (
                        <tr key={row.team.id}>
                          <td className="px-3 py-2">{row.position}</td>
                          <td className="px-3 py-2 font-medium">
                            <Link href={`/football/team/${row.team.id}`} className="hover:text-accent transition-colors">{row.team.name}</Link>
                          </td>
                          <td className="px-2 py-2 text-center text-muted">{row.played}</td>
                          <td className="px-2 py-2 text-center text-muted">{row.won}</td>
                          <td className="px-2 py-2 text-center text-muted">{row.drawn}</td>
                          <td className="px-2 py-2 text-center text-muted">{row.lost}</td>
                          <td className="px-3 py-2 text-center font-bold">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedLeague && (
                  <Link href={`/football/league/${selectedLeague.id}`} className="inline-block mt-3 text-[12px] text-accent hover:underline">
                    To'liq jadvalni ko'rish →
                  </Link>
                )}
              </div>
              <div className="rounded-xl border border-white/8 p-4">
                <div className="text-[12px] text-muted mb-3">Top Scorers</div>
                {topScorers.length === 0 ? (
                  <p className="text-[11px] text-muted">Ma'lumot yo'q</p>
                ) : (
                  <div className="space-y-2">
                    {topScorers.slice(0, 8).map((p: any) => (
                      <div key={p.playerId} className="flex items-center justify-between text-[12px]">
                        <span className="truncate">{p.playerName}</span>
                        <span className="text-muted shrink-0 ml-2">{p.goals}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* News */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Newspaper size={16} className="text-accent" />
            <h2 className="text-[18px] font-bold">Football News</h2>
          </div>
          {news.length === 0 ? (
            <EmptyState message="Hozircha yangilik yo'q." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {news.map((n) => (
                <Link key={n.id} href={`/football/news/${n.slug}`} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 block hover:border-accent/30 transition">
                  <div className="font-semibold text-[14px]">{n.title}</div>
                  <p className="text-[12px] text-muted mt-1.5 line-clamp-2">{n.excerpt}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Videos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Video size={16} className="text-accent" />
            <h2 className="text-[18px] font-bold">Videos</h2>
          </div>
          {videos.length === 0 ? (
            <EmptyState message="Hozircha video yo'q." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {videos.map((v) => (
                <a key={v.id} href={v.video_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/8 bg-white/[0.02] p-4 block hover:border-accent/30 transition">
                  <div className="font-semibold text-[14px] flex items-center gap-2">
                    {v.is_featured && <Star size={11} className="text-vip" fill="currentColor" />} {v.title}
                  </div>
                  {v.description && <p className="text-[12px] text-muted mt-1.5 line-clamp-2">{v.description}</p>}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
      <PublicFooter />
    </div>
  );
}

function FeaturedFixtureCard({ pin }: { pin: any }) {
  const [fixture, setFixture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/football/fixture/${pin.external_fixture_id}`);
        const json = await res.json();
        setFixture(json.fixture);
      } catch {
        setFixture(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [pin.external_fixture_id]);

  return (
    <div className="rounded-xl border border-vip/20 bg-white/[0.02] p-4">
      {loading ? (
        <p className="text-[12px] text-muted">Yuklanmoqda…</p>
      ) : fixture ? (
        <>
          <div className="flex items-center justify-center gap-3 font-semibold text-[14px]">
            <span className="text-right flex-1 truncate">{fixture.homeTeam?.name}</span>
            <span className="px-2.5 py-1 rounded-md bg-white/5 font-mono text-[12px] shrink-0">{fixture.homeScore ?? "-"} : {fixture.awayScore ?? "-"}</span>
            <span className="flex-1 truncate">{fixture.awayTeam?.name}</span>
          </div>
          {pin.note && <p className="text-[11px] text-muted mt-2 text-center">{pin.note}</p>}
          <div className="flex justify-center mt-3">
            <WatchLiveButton footballProvider={pin.provider} externalFixtureId={pin.external_fixture_id} />
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted text-center">Ma'lumot mavjud emas</p>
      )}
    </div>
  );
}
