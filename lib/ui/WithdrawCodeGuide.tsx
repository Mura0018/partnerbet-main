"use client";

import React, { useState } from "react";

type GuideStep = {
  title: string;
  image?: string;
  taps?: { x: number; y: number }[];
  mockHtml?: string;
  caption: string;
};

const STEPS: GuideStep[] = [
  {
    title: "1xBet",
    image: "/guides/withdraw-code/step1.jpg",
    taps: [{ x: 93, y: 9 }],
    caption: "Bosh sahifada yuqori o'ng burchakdagi ⚙️ sozlamalar belgisini bosing",
  },
  {
    title: "Настройки",
    image: "/guides/withdraw-code/step2.jpg",
    taps: [{ x: 50, y: 30 }],
    caption: "Sozlamalarda «Вывести со счета»ni bosing",
  },
  {
    title: "Вывод средств",
    mockHtml: `<div class="wcg-row" style="font-size:11px">Счет 1615391023</div><div class="wcg-row wcg-highlight" style="background:#2456C9;color:#fff">1XBET — Наличные</div>`,
    caption: "Ro'yxatdan «1XBET — Наличные»ni tanlang",
  },
  {
    title: "Ma'lumotlar",
    image: "/guides/withdraw-code/step4.jpg",
    taps: [{ x: 50, y: 73 }],
    caption: "Summani kiriting, kassa nomini (ko'cha) tekshirib «ПОДТВЕРДИТЬ»ni bosing",
  },
];

export function WithdrawCodeGuide() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back" | null>(null);
  const [animating, setAnimating] = useState(false);

  const goTo = (nextIndex: number, dir: "forward" | "back") => {
    if (animating) return;
    setAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setCurrent(nextIndex);
      setDirection(null);
      setAnimating(false);
    }, 800);
  };

  const step = STEPS[current];

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[12.5px] text-[#93a5ba]"
      >
        <span>💡 4 xonali kodni qanday olish kerak?</span>
        <span className="text-[#7db8ff]">{open ? "Yopish ▲" : "Ko'rsatish ▼"}</span>
      </button>

      {open && (
        <div className="relative mt-4">
          <style>{`
            @keyframes wcgIdleBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            .wcg-body { animation: wcgIdleBob 2.6s ease-in-out infinite; transform-origin: bottom center; }
            @keyframes wcgLegSwing1 { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(6deg); } }
            @keyframes wcgLegSwing2 { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-6deg); } }
            .wcg-leg-a { animation: wcgLegSwing1 2.6s ease-in-out infinite; transform-origin: 55px 62px; }
            .wcg-leg-b { animation: wcgLegSwing2 2.6s ease-in-out infinite; transform-origin: 55px 62px; }
            .wcg-arm { transform-origin: 76px 58px; }
            .wcg-arm.wcg-flip { animation: wcgArmFlip 0.8s cubic-bezier(.45,0,.55,1); }
            @keyframes wcgArmFlip {
              0% { transform: rotate(0deg) translateX(0); }
              20% { transform: rotate(-18deg) translateX(-2px); }
              55% { transform: rotate(-115deg) translateX(-10px); }
              80% { transform: rotate(-60deg); }
              100% { transform: rotate(0deg) translateX(0); }
            }
            .wcg-hand.wcg-flip { animation: wcgHandGrab 0.8s cubic-bezier(.45,0,.55,1); }
            @keyframes wcgHandGrab { 0%,15% { transform: rotate(0deg); } 50% { transform: rotate(-35deg); } 100% { transform: rotate(0deg); } }
            .wcg-guide {
              border-radius: 20px; background: rgba(20,34,63,0.55); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
              border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
              padding: 18px; padding-top: 44px; position: relative;
            }
            .wcg-book { position: relative; height: 300px; perspective: 1400px; }
            .wcg-page {
              position: absolute; inset: 0; background: #eef1f5; border-radius: 14px; overflow: hidden;
              transform-origin: left center; backface-visibility: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            }
            .wcg-page.wcg-turning { animation: wcgPageTurn 0.8s cubic-bezier(.45,0,.55,1) forwards; }
            .wcg-page.wcg-turning-back { animation: wcgPageTurnBack 0.8s cubic-bezier(.45,0,.55,1) forwards; transform-origin: right center; }
            @keyframes wcgPageTurn { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(-165deg); } }
            @keyframes wcgPageTurnBack { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(165deg); } }
            .wcg-page.wcg-incoming { transform: rotateY(0deg); z-index: 1; }
            .wcg-page.wcg-below { z-index: 0; }
            .wcg-shot-wrap { position: relative; width: 100%; height: 100%; overflow: hidden; }
            .wcg-shot { width: 100%; height: 100%; object-fit: cover; display: block; }
            @keyframes wcgTapPulse { 0% { transform: scale(0.4); opacity: 0.9; } 70% { transform: scale(2.4); opacity: 0; } 100% { transform: scale(2.4); opacity: 0; } }
            .wcg-tap { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; }
            .wcg-tap .wcg-ring { position: absolute; inset: 0; border-radius: 999px; border: 3px solid #3D7FFF; animation: wcgTapPulse 1.3s ease-out infinite; }
            .wcg-tap .wcg-dotc { position: absolute; inset: 5px; border-radius: 999px; background: #3D7FFF; box-shadow: 0 0 10px #3D7FFF; }
            .wcg-phone-bar { background: #fff; padding: 10px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #e2e6ea; }
            .wcg-phone-bar .wcg-title { color: #1c3f7a; font-weight: 800; font-size: 13px; flex: 1; text-align: center; }
            .wcg-phone-body { padding: 12px; color: #1c3f7a; }
            .wcg-row { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; border: 1px solid #eef1f5; }
            .wcg-highlight { outline: 2px solid #3D7FFF; box-shadow: 0 0 0 4px rgba(61,127,255,0.15); }
          `}</style>

          <svg
            viewBox="0 0 140 110"
            style={{ position: "absolute", top: -66, left: 4, width: 118, height: 92, zIndex: 5 }}
          >
            <g className="wcg-body">
              <g className="wcg-leg-b"><path d="M62 66 Q76 78 70 96" stroke="#0e2a5c" strokeWidth="11" fill="none" strokeLinecap="round" /><ellipse cx="70" cy="98" rx="8" ry="5" fill="#0a1f45" /></g>
              <g className="wcg-leg-a"><path d="M50 66 Q40 80 50 98" stroke="#1c3f7a" strokeWidth="11" fill="none" strokeLinecap="round" /><ellipse cx="51" cy="100" rx="8" ry="5" fill="#132c5c" /></g>
              <rect x="34" y="34" width="42" height="38" rx="15" fill="#3D7FFF" />
              <circle cx="55" cy="47" r="8" fill="#fff" />
              <text x="55" y="51" fontSize="9" fontWeight="800" fill="#2456C9" textAnchor="middle">1x</text>
              <path d="M38 46 Q24 52 22 66" stroke="#3D7FFF" strokeWidth="9" fill="none" strokeLinecap="round" />
              <circle cx="22" cy="66" r="6.5" fill="#ffd9b3" />
              <circle cx="55" cy="20" r="18" fill="#ffd9b3" />
              <path d="M37 16 Q55 -4 73 16 Q73 6 55 5 Q37 6 37 16 Z" fill="#3a2a1a" />
              <circle cx="48" cy="21" r="2.2" fill="#1c1c1c" />
              <circle cx="62" cy="21" r="2.2" fill="#1c1c1c" />
              <path d="M47 28 Q55 32 63 28" stroke="#1c1c1c" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
            <g className={`wcg-arm ${animating ? "wcg-flip" : ""}`}>
              <path d="M74 46 Q92 44 100 30" stroke="#2456C9" strokeWidth="9" fill="none" strokeLinecap="round" />
              <g className={`wcg-hand ${animating ? "wcg-flip" : ""}`} transform="translate(100,30)">
                <circle r="7" fill="#ffd9b3" />
                <path d="M4 -3 Q9 -3 8 2" stroke="#ffd9b3" strokeWidth="3" fill="none" strokeLinecap="round" />
              </g>
            </g>
          </svg>

          <div className="wcg-guide">
            <div className="text-[12px] font-bold text-center mb-3 text-[#dce6f5]">📲 1xBet: pul yechish kodini olish</div>

            <div className="wcg-book">
              <div className={`wcg-page ${direction === "forward" ? "wcg-turning" : direction === "back" ? "wcg-turning-back" : "wcg-incoming"}`}>
                <StepContent step={step} />
              </div>
              {direction && (
                <div className="wcg-page wcg-below">
                  <StepContent step={STEPS[direction === "forward" ? (current + 1) % STEPS.length : current - 1]} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3.5 gap-2">
              <button
                type="button"
                disabled={current === 0 || animating}
                onClick={() => goTo(current - 1, "back")}
                className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-white/[0.08] border border-white/15 text-[#cdd8ea] disabled:opacity-30"
              >
                ‹ Orqaga
              </button>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-accent w-4" : "bg-white/25"}`} />
                ))}
              </div>
              <button
                type="button"
                disabled={animating}
                onClick={() => goTo((current + 1) % STEPS.length, "forward")}
                className="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white bg-gradient-to-r from-accent to-accent-dim"
              >
                Keyingi ›
              </button>
            </div>
            <p className="text-[11px] text-[#b8c6dc] text-center mt-2.5 leading-relaxed">{step.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StepContent({ step }: { step: GuideStep }) {
  if (step.image) {
    return (
      <div className="wcg-shot-wrap">
        <img className="wcg-shot" src={step.image} alt={step.title} />
        {(step.taps ?? []).map((t, i) => (
          <div key={i} className="wcg-tap" style={{ left: `${t.x}%`, top: `${t.y}%` }}>
            <span className="wcg-ring" />
            <span className="wcg-dotc" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="wcg-phone-bar"><span className="wcg-title">{step.title}</span></div>
      <div className="wcg-phone-body" dangerouslySetInnerHTML={{ __html: step.mockHtml ?? "" }} />
    </>
  );
}
