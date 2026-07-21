"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LocaleSwitcher } from "@/lib/i18n/LocaleSwitcher";
import { BrandName } from "@/lib/ui/BrandName";
import { useSiteSettings } from "@/lib/site/useSiteSettings";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const settings = useSiteSettings();
  const siteName: string | undefined = settings.site_identity?.site_name;
  const logoUrl: string | null = settings.branding?.logo_media_id_url ?? null;
  const logoPos: { x: number; y: number } = settings.branding?.logo_media_id_position ?? { x: 50, y: 50 };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5 py-12 relative overflow-hidden">
      <style>{`
        @keyframes authFloat {
          0% { transform: translate(0,0) rotate(0deg); }
          25% { transform: translate(14px,-20px) rotate(2deg); }
          50% { transform: translate(-8px,-38px) rotate(-1deg); }
          75% { transform: translate(-18px,-12px) rotate(1.5deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }
        .auth-chip { animation: authFloat 15s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .auth-chip { animation: none; } }
        .auth-submit-btn::before { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); animation:authShimmer 3s infinite; }
        @keyframes authShimmer { 0%{left:-100%} 60%,100%{left:200%} }
      `}</style>
      <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full bg-accent-dim/10 blur-[140px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />

      <span className="auth-chip absolute top-[9%] left-[6%] text-[15px] font-bold" style={{ color: "rgba(200,220,255,0.16)", animationDelay: "0s" }}>1xBet</span>
      <span className="auth-chip absolute top-[16%] right-[7%] text-[12px] font-bold" style={{ color: "rgba(200,220,255,0.13)", animationDelay: "2s" }}>1xBet</span>
      <span className="auth-chip absolute bottom-[16%] left-[5%] text-[13px] font-bold" style={{ color: "rgba(200,220,255,0.14)", animationDelay: "4s" }}>1xBet</span>
      <span className="auth-chip absolute bottom-[10%] right-[6%] text-[12px] font-bold" style={{ color: "rgba(200,220,255,0.12)", animationDelay: "1s" }}>1xBet</span>

      <div className="absolute top-5 right-5">
        <LocaleSwitcher />
      </div>

      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName || "Logo"} className="w-9 h-9 rounded-lg object-cover shadow-[0_0_20px_rgba(61,127,255,0.4)]" style={{ objectPosition: `${logoPos.x}% ${logoPos.y}%` }} />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.5)]">
              <ShieldCheck size={17} className="text-white" />
            </div>
          )}
          <span className="font-bold text-[18px] text-white">
            <BrandName name={siteName} />
          </span>
        </Link>

        <div className="relative rounded-2xl border border-white/10 bg-panel/60 backdrop-blur-xl p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
          <h1 className="text-[20px] font-bold text-white text-center">{title}</h1>
          {subtitle && <p className="text-[13px] text-muted text-center mt-1.5 leading-relaxed">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-[#5b7089]">
          <ShieldCheck size={12} />
          Xavfsiz, shifrlangan ulanish
        </div>

        {footer && <div className="mt-3 text-center text-[13px] text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[12px] text-[#FF6B85] mt-2">{children}</p>;
}

export function FieldSuccess({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[12px] text-[#4ADE80] mt-2 leading-relaxed">{children}</p>;
}

export const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] text-white outline-none focus:border-accent transition-colors placeholder:text-[#3d4d5f]";

export const submitButtonClass =
  "auth-submit-btn relative overflow-hidden w-full mt-2 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] text-white disabled:opacity-60 disabled:cursor-not-allowed transition hover:brightness-110 active:scale-[0.98]";
