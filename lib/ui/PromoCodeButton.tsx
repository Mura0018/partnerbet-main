"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

// Yagona nusxa (clipboard) mantiqi shu yerda — mini-app ham, public partner
// sahifasi ham SHU komponentni ishlatadi (nusxa mantiqi takrorlanmaydi).
// Yangi proplar barchasi ixtiyoriy — mavjud partner sahifasi chaqiruvi
// (id, code, description) o'zgarmagan holda ishlaydi.
export function PromoCodeButton({
  id,
  code,
  description,
  track = true,
  big = false,
  className,
  codeClassName,
  copyLabel,
  copiedLabel,
}: {
  id?: string;
  code: string;
  description?: string | null;
  track?: boolean;
  big?: boolean;
  className?: string;
  codeClassName?: string;
  copyLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Zaxira: eski usul (clipboard API bloklangan bo'lsa — masalan Telegram
      // WebView). Ko'rinmas textarea + execCommand("copy").
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    // Statistika faqat track=true va id bo'lsa (partner sahifasi). Mini-app'da
    // hozircha statistika yo'q — track=false uzatiladi.
    if (track && id) {
      try {
        await fetch("/api/promo/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCodeId: id }),
        });
      } catch {}
    }
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      onClick={copy}
      className={
        className ??
        "w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-accent/25 bg-accent/5 hover:bg-accent/10 transition text-left"
      }
    >
      <div className="min-w-0">
        <div className={`font-mono font-bold ${big ? "text-[22px] tracking-[0.15em]" : "text-[14px]"} truncate ${codeClassName ?? ""}`}>{code}</div>
        {description && <div className="text-[11px] text-muted mt-0.5 truncate">{description}</div>}
      </div>
      <span className="flex items-center gap-1.5 shrink-0">
        {(copyLabel || copiedLabel) && (
          <span className={`text-[11px] font-semibold ${copied ? "text-cta" : "text-muted"}`}>{copied ? copiedLabel : copyLabel}</span>
        )}
        {copied ? <Check size={16} className="text-cta shrink-0" /> : <Copy size={16} className="text-muted shrink-0" />}
      </span>
    </button>
  );
}
