"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Newspaper, FileText, Smartphone, Megaphone, LogOut, Zap, UserCircle, Users, AlertTriangle, Settings, Handshake, Trophy, FolderTree, Tag, Image as ImageIcon, BellRing, HelpCircle, Radio, Heart, Menu, X, Wallet, ShieldAlert, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/lib/i18n/LocaleSwitcher";
import { Can, useCurrentProfile } from "@/lib/auth/permissions";
import { BrandName } from "@/lib/ui/BrandName";
import { useSiteSettings } from "@/lib/site/useSiteSettings";

const NAV_GROUPS = [
  { label: "Asosiy", items: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
    { href: "/admin/telegram-bot", label: "BetCore Pay", icon: Wallet, permission: "telegram_orders.manage" },
    { href: "/admin/partners", label: "Hamkorlar", icon: Building2, permission: "partners.manage" },
  ]},
  { label: "Kontent", items: [
    { href: "/admin/football", label: "Football Center", icon: Trophy, permission: "football.manage" },
    { href: "/admin/football-news", label: "Football News", icon: Newspaper, permission: "football_news.manage" },
    { href: "/admin/insights", label: "Insights", icon: Newspaper, permission: "match_insights.manage" },
    { href: "/admin/blog", label: "Blog", icon: FileText, permission: "posts.manage" },
    { href: "/admin/media", label: "Media", icon: ImageIcon, permission: "media.manage" },
  ]},
  { label: "Marketing", items: [
    { href: "/admin/banners", label: "Banners", icon: Megaphone, permission: "advertisements.manage" },
    { href: "/admin/affiliates", label: "Affiliates", icon: Handshake, permission: "promotions.manage" },
    { href: "/admin/donations", label: "Donations", icon: Heart, permission: "donations.manage" },
    { href: "/admin/streaming", label: "Live Streaming", icon: Radio, permission: "streaming.manage" },
    { href: "/admin/push", label: "Push", icon: BellRing, permission: "settings.manage" },
  ]},
  { label: "Tizim", items: [
    { href: "/admin/users", label: "Foydalanuvchilar", icon: Users, permission: "users.manage" },
    { href: "/admin/security-log", label: "Xavfsizlik jurnali", icon: ShieldAlert, permission: "security.manage" },
    { href: "/admin/categories", label: "Kategoriyalar", icon: FolderTree, permission: "taxonomy.manage" },
    { href: "/admin/tags", label: "Teglar", icon: Tag, permission: "taxonomy.manage" },
    { href: "/admin/faq", label: "FAQ", icon: HelpCircle, permission: "faqs.manage" },
    { href: "/admin/apk", label: "APK", icon: Smartphone, permission: "apk.manage" },
    { href: "/admin/settings", label: "Sozlamalar", icon: Settings, permission: "settings.manage" },
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
  const settings = useSiteSettings();
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
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-3 pt-3 pb-1.5 text-[9px] font-bold tracking-[0.14em] text-[#4a5f7a] uppercase font-mono">
              <span className="opacity-50">// </span>{group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              const link = (
                <Link
                  key={item.href} href={item.href}
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? "text-white bg-gradient-to-r from-accent/25 to-accent-dim/10 shadow-[0_4px_16px_rgba(61,127,255,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-muted hover:text-white hover:bg-white/[0.04] hover:translate-x-1"
                  }`}
                >
                  <item.icon size={16} className={`transition-transform group-hover:scale-110 ${active ? "text-[#6ba4ff] drop-shadow-[0_0_6px_rgba(61,127,255,0.7)]" : ""}`} />
                  {item.label}
                  {active && <span className="ml-auto w-[7px] h-[7px] rounded-full bg-accent shadow-[0_0_10px_rgba(61,127,255,0.9)] animate-pulse" />}
                </Link>
              );
              return item.permission ? (
                <Can key={item.href} permission={item.permission}>{link}</Can>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/8 space-y-1 shrink-0">
        <Link
          href="/admin/profile"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${
            pathname === "/admin/profile" ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-white"
          }`}
        >
          <UserCircle size={16} /> Profil
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
    </div>
  );
}
