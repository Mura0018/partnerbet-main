"use client";

import React from "react";
import Link from "next/link";
import {
  Trophy, Newspaper, Handshake, Download, Headset,
  Info, HelpCircle, Mail,
  FileText, ShieldCheck, Cookie, HeartHandshake, AlertTriangle, Copyright,
} from "lucide-react";
import { useSiteSettings } from "@/lib/site/useSiteSettings";
import { BrandName } from "@/lib/ui/BrandName";

const BLOCKS = [
  {
    title: "Platforma",
    icon: Trophy,
    links: [
      { href: "/football", label: "Football Center", icon: Trophy },
      { href: "/blog", label: "Yangiliklar", icon: Newspaper },
      { href: "/partners", label: "Hamkorlar", icon: Handshake },
      { href: "/apk", label: "Ilovani yuklash", icon: Download },
      { href: "/support", label: "Qo'llab-quvvatlash", icon: Headset },
    ],
  },
  {
    title: "Kompaniya",
    icon: Info,
    links: [
      { href: "/about", label: "Biz haqimizda", icon: Info },
      { href: "/faq", label: "Ko'p so'raladigan savollar", icon: HelpCircle },
      { href: "/contact", label: "Bog'lanish", icon: Mail },
    ],
  },
  {
    title: "Huquqiy",
    icon: ShieldCheck,
    links: [
      { href: "/legal/terms", label: "Foydalanish shartlari", icon: FileText },
      { href: "/legal/privacy-policy", label: "Maxfiylik siyosati", icon: ShieldCheck },
      { href: "/legal/cookie-policy", label: "Cookie siyosati", icon: Cookie },
      { href: "/legal/responsible-gaming", label: "Mas'uliyatli o'yin", icon: HeartHandshake },
      { href: "/legal/disclaimer", label: "Ogohlantirish", icon: AlertTriangle },
      { href: "/legal/dmca", label: "DMCA", icon: Copyright },
    ],
  },
];

export function PublicFooter() {
  const settings = useSiteSettings();
  const siteName: string | null = settings.site_identity?.site_name ?? null;
  const footerDescription: string | null = settings.footer?.description ?? null;
  const contactEmail: string | null = settings.contact_info?.email ?? null;
  const social: Record<string, string> = settings.social_links ?? {};

  return (
    <footer className="border-t border-white/8 mt-20 bg-white/[0.015]">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        {/* Brand strip */}
        <div className="pb-6 mb-6 border-b border-white/8">
          <div className="font-extrabold text-[17px] tracking-tight mb-2">
            <BrandName name={siteName} />
          </div>
          <p className="text-muted text-[12px] leading-relaxed max-w-xl">
            {footerDescription || "Premium football media & affiliate platform."}
          </p>
          {Object.values(social).some(Boolean) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(social)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-muted hover:text-accent transition-colors capitalize"
                  >
                    {platform}
                  </a>
                ))}
            </div>
          )}
        </div>

        {/* Link columns — no divider lines, clean spacing */}
        <div className="grid grid-cols-3 gap-3 md:gap-8">
          {BLOCKS.map((block) => (
            <div key={block.title}>
              <div className="flex items-center gap-1.5 mb-3">
                <block.icon size={12} className="text-accent hidden md:block" />
                <span className="font-semibold text-[10px] md:text-[12px] uppercase tracking-wide text-white/70">{block.title}</span>
              </div>
              <div className="flex flex-col gap-2 md:gap-2.5">
                {block.links.map((link) => {
                  if (link.href === "/contact" && !contactEmail) {
                    return (
                      <span key={link.href} title="Tez orada" className="flex items-center gap-1.5 text-[11px] md:text-[13px] text-[#3d4d5f] cursor-not-allowed select-none">
                        <link.icon size={12} className="hidden md:block shrink-0" /> {link.label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-1.5 text-[11px] md:text-[13px] text-muted hover:text-white transition-colors"
                    >
                      <link.icon size={12} className="hidden md:block shrink-0" /> <span className="leading-tight">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Compliance line */}
        <p className="text-[10.5px] text-[#5b7089] leading-relaxed mt-7 pt-5 border-t border-white/8">
          <span className="font-semibold text-white/60">18+ only.</span> Gambling can be addictive — please play
          responsibly. {siteName || "WINORA"} is a licensed affiliate marketing platform and does not itself accept
          wagers or hold client funds. Promo codes are issued by third-party licensed operators.
        </p>

        {/* Bottom bar */}
        <div className="mt-6 pt-5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#5b6f85]">
          <span>© {new Date().getFullYear()} {siteName || "WINORA"}. Barcha huquqlar himoyalangan.</span>
          <span>Ishonchli. Xavfsiz. Professional.</span>
        </div>
      </div>
    </footer>
  );
}
