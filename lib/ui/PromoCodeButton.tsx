"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export function PromoCodeButton({ id, code, description }: { id: string; code: string; description?: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard permissions can fail silently — the code is still visible on the button.
    }
    setCopied(true);
    try {
      await fetch("/api/promo/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCodeId: id }),
      });
    } catch {}
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-accent/25 bg-accent/5 hover:bg-accent/10 transition text-left"
    >
      <div>
        <div className="font-mono font-bold text-[14px]">{code}</div>
        {description && <div className="text-[11px] text-muted mt-0.5">{description}</div>}
      </div>
      {copied ? <Check size={16} className="text-cta shrink-0" /> : <Copy size={16} className="text-muted shrink-0" />}
    </button>
  );
}
