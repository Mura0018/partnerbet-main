"use client";

import React from "react";
import Link from "next/link";
import { useSiteSettings } from "@/lib/site/useSiteSettings";

export function PublicFooter() {
  const settings = useSiteSettings();
  const siteName: string | null = settings.site_identity?.site_name ?? null;
  const footerDescription: string | null = settings.footer?.description ?? null;
  const contactEmail: string | null = settings.contact_info?.email ?? null;
  const social: Record<string, string> = settings.social_links ?? {};

  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 grid md:grid-cols-4 gap-8 text-[13px]">
        <div>
          <div className="font-bold text-[15px] mb-3">{siteName || <>PARTNER<span className="text-accent">BET</span></>}</div>
          <p className="text-muted leading-relaxed">{footerDescription || "Premium football media & affiliate platform."}</p>
          {Object.values(social).some(Boolean) && (
            <div className="flex gap-3 mt-3">
              {Object.entries(social).filter(([, url]) => url).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent transition-colors capitalize">{platform}</a>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold mb-3 text-muted">Platform</div>
          <div className="flex flex-col gap-2 text-muted">
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
            {contactEmail ? (
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
            18+ only. Gambling can be addictive — please play responsibly. {siteName || "PartnerBet"} is a
            licensed affiliate marketing platform and does not itself accept wagers or hold
            client funds. Promo codes are issued by third-party licensed operators.
          </p>
        </div>
      </div>
    </footer>
  );
}
