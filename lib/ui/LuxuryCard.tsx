"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

// Shows first 4 and last 5 characters, masks everything between — works
// for card numbers, phone numbers, and crypto addresses alike.
function maskMiddle(value: string): string {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 9) return clean;
  const first = clean.slice(0, 4);
  const last = clean.slice(-5);
  const maskedLen = Math.min(clean.length - 9, 8);
  return `${first} ${"•".repeat(maskedLen)} ${last}`;
}

export function LuxuryCard({
  typeLabel,
  number,
  holderName,
  active,
  onToggleActive,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  typeLabel: string;
  number: string;
  holderName?: string | null;
  active?: boolean;
  onToggleActive?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(number.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="w-full max-w-[340px]">
      <div style={{ perspective: "1200px" }}>
        <div
          onClick={() => setFlipped((f) => !f)}
          className="relative w-full aspect-[1.586/1] cursor-pointer transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          {/* front */}
          <div
            className="absolute inset-0 rounded-2xl p-5 flex flex-col justify-between overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(135deg, #0e1f3d 0%, #16264a 45%, #0a1730 100%)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="absolute -top-1/2 -left-1/3 w-2/3 h-[200%] rotate-12 pointer-events-none"
              style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.07), transparent)" }}
            />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">{typeLabel}</span>
              {active !== undefined && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full border ${
                    active ? "bg-[#4ADE80]/15 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-white/40 border-white/10"
                  }`}
                >
                  {active ? "Faol" : "Nofaol"}
                </span>
              )}
            </div>
            <div className="relative z-10">
              <div
                className="font-mono text-[18px] sm:text-[19px] tracking-[0.06em] font-bold"
                style={{ color: "#F4C76A", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              >
                {maskMiddle(number)}
              </div>
              <div className="flex items-end justify-between mt-3">
                <div className="min-w-0">
                  <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Egasi</div>
                  <div className="text-[13px] font-semibold text-white truncate">{holderName || "—"}</div>
                </div>
                <span className="text-[8px] text-white/30 shrink-0">bosib aylantiring</span>
              </div>
            </div>
          </div>

          {/* back */}
          <div
            className="absolute inset-0 rounded-2xl p-5 flex flex-col items-center justify-center gap-3"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #16264a 0%, #0e1f3d 100%)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="text-[15px] font-bold text-white text-center px-4">{holderName || "—"}</div>
            <div className="font-mono text-[13px] sm:text-[14px] tracking-wider" style={{ color: "#F4C76A" }}>
              {number}
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 text-[11px] text-white hover:bg-white/15 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Nusxalandi" : "Nusxalash"}
            </button>
          </div>
        </div>
      </div>

      {!readOnly && (onToggleActive || onEdit || onDelete) && (
        <div className="flex items-center gap-2 mt-2.5">
          {onToggleActive && (
            <button onClick={onToggleActive} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white transition-colors">
              {active ? "Nofaol qilish" : "Faollashtirish"}
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white transition-colors">
              Tahrirlash
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85]">
              O'chirish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
