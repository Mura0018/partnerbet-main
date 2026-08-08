"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Banner = { id: string; title: string | null; subtitle: string | null; image_url: string | null; link_url: string | null };

// B7 (E): mijoz app pastida almashib turadigan 3D reklama banneri.
// Aktiv bannerlarни oladi, har 5s almashtiradi, bosilганда havolани ochadi.
export function PromoBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch("/api/telegram/miniapp/banners")
      .then((r) => r.json())
      .then((d) => setBanners(d.banners ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[idx % banners.length];

  const open = () => {
    if (!b.link_url) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(b.link_url);
    else window.open(b.link_url, "_blank");
  };

  return (
    <div className="mt-3.5" style={{ perspective: "1000px" }}>
      <button
        onClick={open}
        key={b.id}
        className="relative w-full overflow-hidden rounded-2xl text-left active:translate-y-[2px] transition-all"
        style={{
          minHeight: 96,
          animation: "promoBnrIn 0.5s ease, promoBnrFloat 4s ease-in-out infinite",
          boxShadow: "0 14px 34px rgba(0,0,0,0.5)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Fon */}
        {b.image_url ? (
          <img src={b.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(120deg,var(--surf-3),var(--surf-2),#7c3aed)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,rgba(4,10,24,0.82),rgba(4,10,24,0.35))" }} />
        {/* Shine */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.14) 48%,transparent 62%)", backgroundSize: "250% 100%", animation: "promoBnrShine 3.5s linear infinite" }} />

        <div className="relative px-4 py-3.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {b.title && <div className="text-[15px] font-extrabold text-white truncate">{b.title}</div>}
            {b.subtitle && <div className="text-[11.5px] text-white/75 mt-0.5 truncate">{b.subtitle}</div>}
          </div>
          {b.link_url && <ArrowRight size={18} className="shrink-0 text-white/80" />}
        </div>

        {/* Nuqtalar */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 right-3 flex gap-1">
            {banners.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === idx % banners.length ? "rgba(255,255,255,.95)" : "rgba(255,255,255,0.4)" }} />
            ))}
          </div>
        )}
      </button>

      <style>{`
        @keyframes promoBnrIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes promoBnrFloat { 0%,100%{transform:translateY(0) rotateX(0)} 50%{transform:translateY(-3px) rotateX(2deg)} }
        @keyframes promoBnrShine { 0%{background-position:120% 0} 100%{background-position:-120% 0} }
      `}</style>
    </div>
  );
}
