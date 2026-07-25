"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, Menu, X } from "lucide-react";
import { NotificationBell } from "@/lib/push/NotificationBell";
import { Button } from "@/lib/ui/Button";
import { BrandName } from "@/lib/ui/BrandName";
import { useSiteSettings } from "@/lib/site/useSiteSettings";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const NAV_ITEMS: { href: string; labelKey: string }[] = [
  { href: "/football", labelKey: "home.navFootball" },
  { href: "/blog", labelKey: "home.navNews" },
  { href: "/partners", labelKey: "home.navPartners" },
  { href: "/apk", labelKey: "home.navApp" },
  { href: "/support", labelKey: "home.navSupport" },
];

export function PublicHeader({ active }: { active?: string }) {
  const { t } = useLocale();
  const settings = useSiteSettings();
  const siteName: string | null = settings.site_identity?.site_name ?? null;
  const logoUrl: string | null = settings.branding?.logo_media_id_url ?? null;
  const logoPos: { x: number; y: number } = settings.branding?.logo_media_id_position ?? { x: 50, y: 50 };
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass border-b border-subtle">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName || "Logo"} className="w-8 h-8 rounded-lg object-cover" style={{ objectPosition: `${logoPos.x}% ${logoPos.y}%` }} />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.45)]">
              <Zap size={16} className="text-white" fill="white" />
            </div>
          )}
          {siteName ? (
            <span className="font-bold tracking-tight text-[17px]"><BrandName name={siteName} /></span>
          ) : (
            <span className="font-bold tracking-tight text-[17px]"><BrandName /></span>
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-muted">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={`transition-colors hover:text-white ${active === item.href ? "text-white" : ""}`}>
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button href="/#promos" variant="cta" size="sm" className="hidden sm:inline-flex">{t("home.claimBonus")}</Button>
          <button onClick={() => setMobileOpen((v) => !v)} className="md:hidden p-2 rounded-lg hover:bg-white/5" aria-label="Menyu">
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-subtle px-5 py-3 flex flex-col gap-1 animate-fade-in-up">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="py-2.5 text-[14px] font-medium text-muted hover:text-white">
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
