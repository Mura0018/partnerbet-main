"use client";

import { useEffect } from "react";
import { Zap, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for now; Phase 10 (Security) wires this to a real
    // server-side audit/error log.
    console.error("WINORA runtime error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg text-white flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[38rem] h-[38rem] rounded-full bg-[#FF3B5C]/10 blur-[120px]" />
      <div className="relative text-center max-w-md">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_20px_rgba(61,127,255,0.5)] mb-6">
          <Zap size={22} className="text-white" fill="white" />
        </div>
        <div className="text-[80px] font-extrabold leading-none bg-gradient-to-r from-[#FF3B5C] to-vip bg-clip-text text-transparent">
          500
        </div>
        <h1 className="text-[20px] font-bold mt-3">Nimadir xato ketdi</h1>
        <p className="text-[14px] text-muted mt-2 leading-relaxed">
          Kutilmagan server xatosi yuz berdi. Iltimos, qaytadan urinib ko'ring.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] shadow-[0_0_30px_rgba(61,127,255,0.4)]"
        >
          <RotateCcw size={16} /> Qayta urinish
        </button>
      </div>
    </div>
  );
}
