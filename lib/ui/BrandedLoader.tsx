"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { BrandName } from "@/lib/ui/BrandName";

export function BrandedLoader({ label = "Yuklanmoqda...", siteName }: { label?: string; siteName?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <style>{`
        @keyframes brandedSpin { to { transform: rotate(360deg); } }
        @keyframes brandedSpinReverse { to { transform: rotate(-360deg); } }
        @keyframes brandedBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes brandedWave {
          0%, 60%, 100% { transform: translateY(0); background-color: #3D7FFF; opacity: 0.4; }
          30% { transform: translateY(-8px); background-color: #fff; opacity: 1; }
        }
        @keyframes brandedPulseGlow { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 1; } }
        .branded-glow { animation: brandedPulseGlow 2.6s ease-in-out infinite; }
        .branded-ring { animation: brandedSpin 1.4s linear infinite; }
        .branded-ring2 { animation: brandedSpinReverse 2s linear infinite; }
        .branded-shield { animation: brandedBreathe 2.2s ease-in-out infinite; }
        .branded-dot { animation: brandedWave 1.2s ease-in-out infinite; }
        .branded-label { animation: brandedFade 1.8s ease-in-out infinite; }
        @keyframes brandedFade { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .branded-glow, .branded-ring, .branded-ring2, .branded-shield, .branded-dot, .branded-label { animation: none; }
        }
      `}</style>

      <div className="relative w-[88px] h-[88px]">
        <div
          className="branded-glow absolute -inset-4 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(61,127,255,0.28), transparent 70%)", filter: "blur(16px)" }}
        />
        <div
          className="branded-ring absolute inset-0 rounded-full"
          style={{ border: "2px solid transparent", borderTopColor: "#3D7FFF", borderRightColor: "rgba(61,127,255,0.3)" }}
        />
        <div
          className="branded-ring2 absolute inset-[10px] rounded-full"
          style={{ border: "2px solid transparent", borderBottomColor: "rgba(255,255,255,0.5)" }}
        />
        <div className="branded-shield absolute inset-[22px] rounded-2xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_24px_rgba(61,127,255,0.6)]">
          <ShieldCheck size={26} className="text-white" />
        </div>
      </div>

      <div className="font-extrabold text-[15px] tracking-wide">
        <BrandName name={siteName} />
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="branded-dot w-[7px] h-[7px] rounded-full bg-[#3D7FFF]"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <div className="branded-label text-[13px] text-[#93a5ba]">{label}</div>
    </div>
  );
}
