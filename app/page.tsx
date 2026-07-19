"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Zap, Download, TrendingUp, Radio, ChevronRight,
  MessageCircle, Shield, Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { NotificationBell } from "@/lib/push/NotificationBell";

type Insight = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  match_time: string;
  expected_goals: string | null;
  possession_trend: string | null;
  confidence: number | null;
  analysis: string | null;
  status: string;
};

function ConfidencePulse({ value }: { value: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#12233A" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="url(#pulseGrad)"
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
        <defs>
          <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00A3FF" />
            <stop offset="100%" stopColor="#FFC857" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white leading-none">{value}</span>
        <span className="text-[9px] tracking-widest text-muted mt-0.5">CONF.</span>
      </div>
    </div>
  );
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "gold" | "live" }) {
  const tones = {
    blue: "bg-accent/10 text-[#5EC2FF] border-accent/30",
    gold: "bg-vip/10 text-vip border-vip/30",
    live: "bg-[#FF3B5C]/10 text-[#FF6B85] border-[#FF3B5C]/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Nav items that already have a real destination on this page today.
// Items without a working destination yet are intentionally NOT clickable —
// they render as disabled "coming soon" text instead of a dead "#" link.
// (Blog / Support / Standings get real pages in later phases.)
const NAV_LIVE: { label: string; href: string }[] = [
  { label: "Insights", href: "#insights" },
  { label: "Live", href: "#live-scores" },
  { label: "APK", href: "#apk" },
];

export default function Home() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [liveScores, setLiveScores] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [siteSettings, setSiteSettings] = useState<{
    identity: { site_name?: string; branding_logo_url?: string };
    footer: { description?: string };
    contact: { email?: string };
    social: Record<string, string>;
  }>({ identity: {}, footer: {}, contact: {}, social: {} });
  const [partners, setPartners] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const trackedPageView = useRef(false);

  // Affiliate partners + their active promo codes (Phase 3b).
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("affiliate_partners")
          .select("id, slug, name, logo_url, bonus_description, rating, is_featured, promo_codes(id, code, bonus_description, is_featured)")
          .order("priority", { ascending: true })
          .limit(6);
        setPartners(data ?? []);
      } catch {
        // Keep the section empty/honest if Supabase isn't reachable.
      }
    })();
  }, []);

  const copyPromoCode = async (promoId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API can fail — code is still visible on screen either way.
    }
    setCopiedCode(promoId);
    try {
      await fetch("/api/promo/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCodeId: promoId }),
      });
    } catch {}
    setTimeout(() => setCopiedCode(null), 1600);
  };

  // Site-wide branding/footer/social — admin-configurable (Site Settings,
  // Phase 3). Falls back to static defaults if not yet configured.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("site_settings")
          .select("key, value")
          .in("key", ["site_identity", "branding", "footer", "contact_info", "social_links"]);
        const byKey = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as any]));
        setSiteSettings({
          identity: { site_name: byKey.site_identity?.site_name, branding_logo_url: byKey.branding?.logo_media_id_url },
          footer: { description: byKey.footer?.description },
          contact: { email: byKey.contact_info?.email },
          social: byKey.social_links ?? {},
        });
      } catch {
        // Keep static defaults if Supabase isn't reachable.
      }
    })();
  }, []);

  // Pull insights from Supabase — no fallback demo data. If the table is
  // empty or Supabase isn't configured yet, the UI shows an honest empty
  // state instead of fabricated matches.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("match_insights")
          .select("*")
          .order("match_time", { ascending: true })
          .limit(6);
        if (!error && data) setInsights(data as Insight[]);
      } catch {
        // Supabase not configured yet — insights stays empty, UI shows empty state.
      } finally {
        setInsightsLoading(false);
      }

      // Track page view once per mount (guarded against React StrictMode's
      // double-invoke in development, which would otherwise double-count).
      if (!trackedPageView.current) {
        trackedPageView.current = true;
        try {
          const supabase = createClient();
          await supabase.from("analytics_events").insert({ event_type: "page_view" });
        } catch {
          // Analytics is best-effort — never block the page on it.
        }
      }
    })();
  }, []);

  // Pull live scores from our server-side API route (keeps API key private)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/football/fixtures?live=all");
        const json = await res.json();
        setLiveScores(json?.response ?? []);
      } catch {
        setLiveScores([]);
      } finally {
        setLoadingLive(false);
      }
    })();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-bg text-white selection:bg-accent/30">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full bg-vip/5 blur-[140px]" />
      </div>

      <header className="sticky top-0 z-40 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {siteSettings.identity.branding_logo_url ? (
              <img src={siteSettings.identity.branding_logo_url} alt={siteSettings.identity.site_name || "Logo"} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.5)]">
                <Zap size={16} className="text-white" fill="white" />
              </div>
            )}
            {siteSettings.identity.site_name ? (
              <span className="font-bold tracking-tight text-[17px]">{siteSettings.identity.site_name}</span>
            ) : (
              <span className="font-bold tracking-tight text-[17px]">PARTNER<span className="text-accent">BET</span></span>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-muted">
            {NAV_LIVE.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollTo(item.href.slice(1))}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ))}
            <Link href="/football" className="hover:text-white transition-colors">Football Center</Link>
            <Link href="/blog" className="hover:text-white transition-colors">News</Link>
            <Link href="/partners" className="hover:text-white transition-colors">Partners</Link>
            <Link href="/apk" className="hover:text-white transition-colors">App</Link>
            <Link href="/support" className="hover:text-white transition-colors">Support</Link>
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => scrollTo("promos")}
              className="text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cta to-cta-dim hover:brightness-110 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(23,201,100,0.35)]"
            >
              Open Partner
            </button>
          </div>
        </div>
      </header>

      <section className="relative max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Badge tone="live"><Radio size={11} className="animate-pulse" /> {liveScores.length} matches live now</Badge>
          <h1 className="mt-5 text-[42px] leading-[1.05] md:text-[64px] font-extrabold tracking-tight">
            BET SMARTER<br />
            <span className="bg-gradient-to-r from-accent to-vip bg-clip-text text-transparent">WIN BIGGER</span>
          </h1>
          <p className="mt-5 text-muted text-[16px] leading-relaxed max-w-md">
            Daily football analytics, live scores, APK access, and professional match insights.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => scrollTo("promos")}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cta to-cta-dim font-semibold text-[14px] shadow-[0_0_30px_rgba(23,201,100,0.4)] transition-all active:scale-[0.98] hover:brightness-110"
            >
              Claim Bonus <ChevronRight size={16} />
            </button>
            <Link
              href="/apk"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cta to-cta-dim font-semibold text-[14px] shadow-[0_0_24px_rgba(23,201,100,0.3)] hover:brightness-110 transition-all active:scale-[0.98]"
            >
              <Download size={16} /> Download App
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-muted leading-relaxed max-w-md">
            18+ only. Gambling can be addictive — play responsibly. WINORA is an independent
            football analytics platform and licensed affiliate partner; it does not accept wagers
            directly. See full affiliate disclosure in the footer.
          </p>
        </div>

        {insights[0] && (
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-panel to-[#0A1626] p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <Badge tone="blue"><TrendingUp size={11} /> Top Insight</Badge>
              <span className="text-[11px] text-muted">{insights[0].league}</span>
            </div>
            <div className="flex items-center gap-4">
              <ConfidencePulse value={insights[0].confidence ?? 50} />
              <div>
                <div className="font-bold text-[18px]">{insights[0].home_team} <span className="text-muted font-normal">vs</span> {insights[0].away_team}</div>
                <div className="text-[13px] text-muted mt-0.5">xG {insights[0].expected_goals ?? "—"}</div>
              </div>
            </div>
            <p className="text-[13px] text-muted mt-4 leading-relaxed">{insights[0].analysis}</p>
          </div>
        )}
      </section>

      <section id="promos" className="max-w-7xl mx-auto px-5 md:px-8 pb-16 scroll-mt-20">
        <div className="flex items-end justify-between mb-5">
          <h2 className="text-[22px] font-bold">Partner Promo Codes</h2>
        </div>
        {partners.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
            Hozircha hamkorlar mavjud emas. Tez orada qo'shiladi.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {partners.map((partner) => {
              const activeCodes = (partner.promo_codes ?? []).filter((c: any) => c.is_active !== false);
              const topCode = activeCodes.find((c: any) => c.is_featured) ?? activeCodes[0];
              return (
                <a
                  href={`/partners/${partner.slug}`}
                  key={partner.id}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-5 flex items-center gap-4 hover:border-accent/30 transition"
                >
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[14px]">{partner.name}</span>
                      {partner.rating && <span className="text-[11px] text-vip">★ {partner.rating}</span>}
                    </div>
                    <p className="text-[12px] text-muted mt-0.5 line-clamp-1">{partner.bonus_description}</p>
                  </div>
                  {topCode ? (
                    <button
                      onClick={(e) => { e.preventDefault(); copyPromoCode(topCode.id, topCode.code); }}
                      className="shrink-0 px-3 py-2 rounded-lg border border-accent/30 bg-accent/10 text-accent font-mono text-[12px] font-semibold hover:bg-accent/20 transition"
                    >
                      {copiedCode === topCode.id ? "Nusxalandi ✓" : topCode.code}
                    </button>
                  ) : (
                    <span className="shrink-0 px-3.5 py-2.5 rounded-lg bg-gradient-to-r from-cta to-cta-dim text-white font-semibold text-[12px]">
                      Batafsil
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section id="insights" className="max-w-7xl mx-auto px-5 md:px-8 pb-16 scroll-mt-20">
        <h2 className="text-[22px] font-bold mb-5">Match Insights</h2>
        {insightsLoading && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
            Yuklanmoqda…
          </div>
        )}
        {!insightsLoading && insights.length === 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
            Hozircha tahlillar mavjud emas. Tez orada qo'shiladi.
          </div>
        )}
        {insights.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4">
            {insights.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                  <Badge tone={m.status === "LIVE" ? "live" : "blue"}>{m.league}</Badge>
                  <span className="text-[11px] text-muted">{new Date(m.match_time).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ConfidencePulse value={m.confidence ?? 50} />
                  <div>
                    <div className="font-bold text-[15px] leading-tight">{m.home_team}</div>
                    <div className="text-[11px] text-muted my-0.5">vs</div>
                    <div className="font-bold text-[15px] leading-tight">{m.away_team}</div>
                  </div>
                </div>
                <p className="text-[12.5px] text-muted mt-3 leading-relaxed">{m.analysis}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="live-scores" className="max-w-7xl mx-auto px-5 md:px-8 pb-16 scroll-mt-20">
        <h2 className="text-[22px] font-bold mb-5">Live Scores</h2>
        <div className="rounded-xl border border-white/8 divide-y divide-white/5 overflow-hidden">
          {loadingLive && (
            <div className="px-5 py-6 text-center text-[13px] text-muted">Loading live matches…</div>
          )}
          {!loadingLive && liveScores.length === 0 && (
            <div className="px-5 py-6 text-center text-[13px] text-muted">
              Hozircha jonli o'yin yo'q, yoki Football Data provayderi hali sozlanmagan (Admin &gt; Sozlamalar &gt; API kalitlar).
            </div>
          )}
          {liveScores.slice(0, 8).map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <Badge tone="live">{f.fixture?.status?.elapsed ?? "-"}'</Badge>
              <div className="flex items-center gap-4 font-semibold text-[14px]">
                <span className="text-right w-28 truncate">{f.teams?.home?.name}</span>
                <span className="px-3 py-1 rounded-md bg-white/5 font-mono">
                  {f.goals?.home ?? 0} – {f.goals?.away ?? 0}
                </span>
                <span className="w-28 truncate">{f.teams?.away?.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="apk" className="max-w-7xl mx-auto px-5 md:px-8 pb-16 scroll-mt-20">
        <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-panel to-bg p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <Badge tone="gold"><Flame size={11} /> Latest version</Badge>
            <h2 className="text-[26px] md:text-[32px] font-bold mt-4">Get the WINORA app</h2>
            <p className="text-[14px] text-muted mt-2 max-w-md leading-relaxed">
              Live scores, push alerts and match insights in your pocket.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/apk"
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cta to-cta-dim font-semibold text-[14px] shadow-[0_0_24px_rgba(23,201,100,0.3)] hover:brightness-110 transition-all active:scale-[0.98]"
              >
                <Download size={16} /> Download App
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-5 text-[11px] text-muted">
              <Shield size={13} /> Verified build · checksum published on the install guide
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-20">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
              <MessageCircle size={18} className="text-accent" />
            </div>
            <div>
              <div className="font-semibold text-[15px]">Need help? We're online.</div>
              <div className="text-[13px] text-muted">Average reply time under 3 minutes.</div>
            </div>
          </div>
          <span
            title="Support chat Phase 4'da qo'shiladi"
            className="px-5 py-2.5 rounded-lg border border-white/10 text-muted font-semibold text-[13px] cursor-not-allowed select-none"
          >
            Tez orada
          </span>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 grid md:grid-cols-4 gap-8 text-[13px]">
          <div>
            {siteSettings.identity.site_name ? (
              <div className="font-bold text-[15px] mb-3">{siteSettings.identity.site_name}</div>
            ) : (
              <div className="font-bold text-[15px] mb-3">PARTNER<span className="text-accent">BET</span></div>
            )}
            <p className="text-muted leading-relaxed">
              {siteSettings.footer.description || "Premium football media & affiliate platform."}
            </p>
            {Object.values(siteSettings.social).some(Boolean) && (
              <div className="flex gap-3 mt-3">
                {Object.entries(siteSettings.social).filter(([, url]) => url).map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent transition-colors capitalize">
                    {platform}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="font-semibold mb-3 text-muted">Platform</div>
            <div className="flex flex-col gap-2 text-muted">
              <button onClick={() => scrollTo("insights")} className="text-left hover:text-white transition-colors">Insights</button>
              <button onClick={() => scrollTo("live-scores")} className="text-left hover:text-white transition-colors">Live Scores</button>
              <Link href="/football" className="hover:text-white transition-colors">Football Center</Link>
              <Link href="/blog" className="hover:text-white transition-colors">News</Link>
              <Link href="/partners" className="hover:text-white transition-colors">Partners</Link>
              <Link href="/apk" className="hover:text-white transition-colors">Download App</Link>
              <Link href="/support" className="hover:text-white transition-colors">Support Us</Link>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-3 text-muted">Company</div>
            <div className="flex flex-col gap-2 text-muted">
              <Link href="/about" className="hover:text-white transition-colors">About Us</Link>
              <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
              {siteSettings.contact.email ? (
                <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              ) : (
                <span title="Tez orada" className="cursor-not-allowed select-none text-[#3d4d5f]">Contact</span>
              )}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-3 text-muted">Legal</div>
            <div className="flex flex-col gap-2 text-muted mb-3">
              <Link href="/legal/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <Link href="/legal/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/legal/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
              <Link href="/legal/responsible-gaming" className="hover:text-white transition-colors">Responsible Gaming</Link>
              <Link href="/legal/disclaimer" className="hover:text-white transition-colors">Disclaimer</Link>
              <Link href="/legal/dmca" className="hover:text-white transition-colors">DMCA</Link>
            </div>
            <p className="text-muted leading-relaxed text-[12px]">
              18+ only. Gambling can be addictive — please play responsibly.{" "}
              {siteSettings.identity.site_name || "WINORA"} is a
              licensed affiliate marketing platform and does not itself accept wagers or hold
              client funds. Promo codes are issued by third-party licensed operators.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
