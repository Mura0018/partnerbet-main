"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Newspaper, FileText, Smartphone, Megaphone, LogOut, Zap, UserCircle, Users, AlertTriangle, Settings, Handshake, Trophy, FolderTree, Tag, Image as ImageIcon, BellRing, HelpCircle, Radio, Heart, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/lib/i18n/LocaleSwitcher";
import { Can, useCurrentProfile } from "@/lib/auth/permissions";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/admin/affiliates", label: "Affiliates", icon: Handshake, permission: "promotions.manage" },
  { href: "/admin/banners", label: "Banners", icon: Megaphone, permission: "advertisements.manage" },
  { href: "/admin/football", label: "Football Center", icon: Trophy, permission: "football.manage" },
  { href: "/admin/streaming", label: "Live Streaming", icon: Radio, permission: "streaming.manage" },
  { href: "/admin/donations", label: "Donations", icon: Heart, permission: "donations.manage" },
  { href: "/admin/football-news", label: "Football News", icon: Newspaper, permission: "football_news.manage" },
  { href: "/admin/insights", label: "Insights", icon: Newspaper, permission: "match_insights.manage" },
  { href: "/admin/blog", label: "Blog", icon: FileText, permission: "posts.manage" },
  { href: "/admin/categories", label: "Kategoriyalar", icon: FolderTree, permission: "taxonomy.manage" },
  { href: "/admin/tags", label: "Teglar", icon: Tag, permission: "taxonomy.manage" },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon, permission: "media.manage" },
  { href: "/admin/faq", label: "FAQ", icon: HelpCircle, permission: "faqs.manage" },
  { href: "/admin/apk", label: "APK", icon: Smartphone, permission: "apk.manage" },
  { href: "/admin/push", label: "Push Notifications", icon: BellRing, permission: "settings.manage" },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: Users, permission: "users.manage" },
  { href: "/admin/settings", label: "Sozlamalar", icon: Settings, permission: "settings.manage" },
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
      <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-[14px]">WINORA <span className="text-muted font-normal">Admin</span></span>
        </div>
        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10" aria-label="Menyuni yopish">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const link = (
            <Link
              key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition ${
                active ? "bg-accent/10 text-accent" : "text-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={16} /> {item.label}
            </Link>
          );
          return item.permission ? (
            <Can key={item.href} permission={item.permission}>{link}</Can>
          ) : (
            link
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
    <div className="min-h-screen bg-bg text-white md:flex">
      <div className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/8 bg-panel/40 sticky top-0 z-30">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/10" aria-label="Menyuni ochish">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center">
            <Zap size={12} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-[13px]">WINORA Admin</span>
        </div>
        <div className="w-9" />
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-60 shrink-0 border-r border-white/8 bg-bg-elevated md:bg-panel/40 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <Suspense fallback={null}>
          <ForbiddenBanner />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
