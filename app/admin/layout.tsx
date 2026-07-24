"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Newspaper, FileText, Smartphone, Megaphone, LogOut, Zap, UserCircle, Users, AlertTriangle, Settings, Handshake, Trophy, FolderTree, Tag, Image as ImageIcon, BellRing, HelpCircle, Radio, Heart, Menu, X, Wallet, ShieldAlert, Building2, Receipt, KeyRound, Contact, BarChart3, Landmark, Gauge, SlidersHorizontal, QrCode, Activity, MessageCircle, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/lib/i18n/LocaleSwitcher";
import { Can, useCurrentProfile } from "@/lib/auth/permissions";
import { BrandName } from "@/lib/ui/BrandName";
import { useSiteSettings } from "@/lib/site/useSiteSettings";
import { Toaster } from "@/lib/ui/toast";

// 7 rangli guruh (mockup v3 IA). Rang = bo'lim (bezak emas) — 2-bosqichda
// ikonka/chap chiziq/badge shu rangdan oladi. Barcha 30 sahifa saqlangan.
const NAV_GROUPS = [
  { id: "main", color: "#2E8FFF", labelKey: "nav.g_main", items: [
    { href: "/admin/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, permission: null },
    { href: "/admin/reports", labelKey: "nav.reports", icon: BarChart3, permission: "reports.view" },
  ]},
  { id: "pay", color: "#12D9A0", labelKey: "nav.g_pay", items: [
    { href: "/admin/telegram-bot", labelKey: "nav.orders", icon: Wallet, permission: "telegram_orders.manage" },
    { href: "/admin/customers", labelKey: "nav.customers", icon: Contact, permission: "customers.manage" },
    { href: "/admin/cashdesks", labelKey: "nav.cashdesks", icon: Landmark, permission: "cashdesks.manage" },
    { href: "/admin/promo/scan", labelKey: "nav.promoScan", icon: QrCode, permission: "telegram_orders.manage" },
  ]},
  { id: "team", color: "#8B5CFF", labelKey: "nav.g_team", items: [
    { href: "/admin/operator-rating", labelKey: "nav.operatorRating", icon: Gauge, permission: "operators.oversight" },
    { href: "/admin/staff-monitor", labelKey: "nav.staffMonitor", icon: Activity, permission: "operators.oversight" },
    { href: "/admin/telegram-bot?chat=1", labelKey: "nav.teamChat", icon: MessageCircle, permission: "telegram_orders.manage" },
  ]},
  { id: "partner", color: "#22D3EE", labelKey: "nav.g_partner", items: [
    { href: "/admin/partners", labelKey: "nav.partners", icon: Building2, permission: "partners.manage" },
    { href: "/admin/tariffs", labelKey: "nav.tariffs", icon: Receipt, permission: "partners.manage" },
  ]},
  { id: "marketing", color: "#FFB020", labelKey: "nav.g_marketing", items: [
    { href: "/admin/promo", labelKey: "nav.promo", icon: Trophy, permission: "promo.manage" },
    { href: "/admin/promo/banners", labelKey: "nav.promoBanners", icon: Megaphone, permission: "promo.manage" },
    { href: "/admin/banners", labelKey: "nav.banners", icon: Megaphone, permission: "advertisements.manage" },
    { href: "/admin/affiliates", labelKey: "nav.affiliates", icon: Handshake, permission: "promotions.manage" },
    { href: "/admin/donations", labelKey: "nav.donations", icon: Heart, permission: "donations.manage" },
    { href: "/admin/streaming", labelKey: "nav.streaming", icon: Radio, permission: "streaming.manage" },
    { href: "/admin/push", labelKey: "nav.push", icon: BellRing, permission: "settings.manage" },
  ]},
  { id: "kontent", color: "#FF6FB3", labelKey: "nav.g_content", items: [
    { href: "/admin/blog", labelKey: "nav.blog", icon: FileText, permission: "posts.manage" },
    { href: "/admin/football", labelKey: "nav.football", icon: Trophy, permission: "football.manage" },
    { href: "/admin/football-news", labelKey: "nav.footballNews", icon: Newspaper, permission: "football_news.manage" },
    { href: "/admin/insights", labelKey: "nav.insights", icon: Newspaper, permission: "match_insights.manage" },
    { href: "/admin/media", labelKey: "nav.media", icon: ImageIcon, permission: "media.manage" },
    { href: "/admin/faq", labelKey: "nav.faq", icon: HelpCircle, permission: "faqs.manage" },
  ]},
  { id: "system", color: "#7D8CA6", labelKey: "nav.g_system", items: [
    { href: "/admin/users", labelKey: "nav.users", icon: Users, permission: "users.manage" },
    { href: "/admin/roles", labelKey: "nav.roles", icon: KeyRound, permission: "roles.manage" },
    { href: "/admin/security-log", labelKey: "nav.securityLog", icon: ShieldAlert, permission: "security.manage" },
    { href: "/admin/categories", labelKey: "nav.categories", icon: FolderTree, permission: "taxonomy.manage" },
    { href: "/admin/tags", labelKey: "nav.tags", icon: Tag, permission: "taxonomy.manage" },
    { href: "/admin/apk", labelKey: "nav.apk", icon: Smartphone, permission: "apk.manage" },
    { href: "/admin/control", labelKey: "nav.control", icon: SlidersHorizontal, permission: "settings.manage" },
    { href: "/admin/settings", labelKey: "nav.settings", icon: Settings, permission: "settings.manage" },
  ]},
];

function ForbiddenBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "forbidden") return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FF3B5C]/10 border-b border-[#FF3B5C]/30 text-[#FF6B85] text-[13px]">
      <AlertTriangle size={14} /> Bu bo'limga kirish uchun ruxsatingiz yo'q.
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const { profile } = useCurrentProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const settings = useSiteSettings();

  // Guruh yig'ilgan/ochiq holati — localStorage'da saqlanadi (reload'dan keyin ham).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("admin_nav_collapsed");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* skip */
    }
  }, []);
  const toggleGroup = (id: string) =>
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem("admin_nav_collapsed", JSON.stringify(next));
      } catch {
        /* skip */
      }
      return next;
    });
  const siteName: string = settings.site_identity?.site_name?.trim() || "WINORA";
  const logoUrl: string | null = settings.branding?.logo_media_id_url ?? null;
  const logoPos: { x: number; y: number } = settings.branding?.logo_media_id_position ?? { x: 50, y: 50 };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const sidebarContent = (
    <>
      <span className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] z-10 bg-gradient-to-r from-transparent via-accent/60 to-transparent" style={{ animation: "sidebarScan 5s linear infinite" }} />
      <style>{`@keyframes sidebarScan { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
      <div className="relative h-16 flex items-center justify-between gap-2 px-5 border-b border-white/8 shrink-0">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-7 h-7 rounded-lg object-cover shadow-[0_0_14px_rgba(61,127,255,0.35)]" style={{ objectPosition: `${logoPos.x}% ${logoPos.y}%` }} />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_14px_rgba(61,127,255,0.35)]">
              <Zap size={14} className="text-white" fill="white" />
            </div>
          )}
          <span className="font-bold text-[14px]"><BrandName name={siteName} /> <span className="text-muted font-normal">Admin</span></span>
        </div>
        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10" aria-label="Menyuni yopish">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto relative">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = !!collapsed[group.id];
          const g = group.color;
          return (
            <div key={group.labelKey} className="mb-1" style={{ ["--g" as any]: g }}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-[#4a5f7a] uppercase font-mono hover:text-[#6b80a0] transition-colors"
              >
                <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: g, boxShadow: `0 0 8px ${g}` }} />
                <ChevronDown size={10} className="shrink-0 opacity-60 transition-transform duration-200" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }} />
                {t(group.labelKey as any)}
              </button>
              <div
                className="overflow-hidden transition-[max-height] duration-200 ease-out"
                style={{ maxHeight: isCollapsed ? 0 : group.items.length * 46 + 4 }}
              >
                {group.items.map((item) => {
                  // Query'li havola (masalan ?chat=1) — "ishga tushiruvchi", hech qachon
                  // active bo'lmaydi (aks holda bir sahifada 2 ta item yonardi).
                  const active = !item.href.includes("?") && pathname.startsWith(item.href);
                  const link = (
                    <Link
                      key={item.href} href={item.href}
                      className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                        active ? "text-white" : "text-muted hover:text-white hover:bg-white/[0.04] hover:translate-x-1"
                      }`}
                      style={active ? { background: `linear-gradient(95deg, ${g}26, transparent 82%)`, boxShadow: `0 4px 16px -6px ${g}8c, inset 0 1px 0 rgba(255,255,255,0.07)` } : undefined}
                    >
                      {active && <span className="absolute -left-2 top-[9px] bottom-[9px] w-[3px] rounded-r" style={{ background: g, boxShadow: `0 0 10px ${g}` }} />}
                      <item.icon size={16} className="transition-transform group-hover:scale-110" style={active ? { color: g, filter: `drop-shadow(0 0 6px ${g}b3)` } : undefined} />
                      {t(item.labelKey as any)}
                      {active && <span className="ml-auto w-[7px] h-[7px] rounded-full animate-pulse" style={{ background: g, boxShadow: `0 0 10px ${g}` }} />}
                    </Link>
                  );
                  return item.permission ? (
                    <Can key={item.href} permission={item.permission}>{link}</Can>
                  ) : (
                    link
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/8 space-y-1 shrink-0">
        <Link
          href="/admin/profile"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${
            pathname === "/admin/profile" ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-white"
          }`}
        >
          <UserCircle size={16} /> {t("nav.profile" as any)}
          {profile?.roles?.key && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted">
              {t(`roles.${profile.roles.key}` as any)}
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#FF6B85] hover:bg-[#FF3B5C]/10"
        >
          <LogOut size={16} /> {t("common.logout")}
        </button>
        <div className="px-3 pt-2">
          <LocaleSwitcher />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-[100svh] bg-bg text-white md:flex overflow-x-hidden">
      <div className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/8 bg-panel/40 sticky top-0 z-30">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/10" aria-label="Menyuni ochish">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-6 h-6 rounded-md object-cover" style={{ objectPosition: `${logoPos.x}% ${logoPos.y}%` }} />
          ) : (
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center">
              <Zap size={12} className="text-white" fill="white" />
            </div>
          )}
          <span className="font-bold text-[13px]"><BrandName name={siteName} /> Admin</span>
        </div>
        <div className="w-9" />
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-60 shrink-0 border-r border-white/8 bg-bg-elevated md:bg-panel/40 flex flex-col transition-transform duration-200 overflow-hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
        <Suspense fallback={null}>
          <ForbiddenBanner />
        </Suspense>
        {children}
      </main>
      <Toaster />
    </div>
  );
}
