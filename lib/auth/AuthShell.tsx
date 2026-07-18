"use client";

import React from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { LocaleSwitcher } from "@/lib/i18n/LocaleSwitcher";

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
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5 py-12 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-40 w-[32rem] h-[32rem] rounded-full bg-vip/5 blur-[140px]" />

      <div className="absolute top-5 right-5">
        <LocaleSwitcher />
      </div>

      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.5)]">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-[18px] text-white">
            PARTNER<span className="text-accent">BET</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-panel/60 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-[20px] font-bold text-white text-center">{title}</h1>
          {subtitle && <p className="text-[13px] text-muted text-center mt-1.5 leading-relaxed">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-[13px] text-muted">{footer}</div>}
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
  "w-full mt-2 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] text-white disabled:opacity-60 disabled:cursor-not-allowed transition hover:brightness-110";
