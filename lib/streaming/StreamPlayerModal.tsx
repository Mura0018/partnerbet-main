"use client";

import React, { useEffect, useState } from "react";
import { X, RotateCcw, WifiOff, AlertCircle, Loader2 } from "lucide-react";

type ResolveResult = { available: boolean; streamUrl?: string; status?: string; error?: string };

export function StreamPlayerModal({ matchStreamId, providerName, onClose }: { matchStreamId: string; providerName: string; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`/api/streaming/resolve/${matchStreamId}`);
      const json: ResolveResult = await res.json();
      if (!json.available || !json.streamUrl) {
        setErrorMessage(
          json.error === "not_started" ? "Efir hali boshlanmagan." :
          json.error === "ended" ? "Efir tugagan." :
          "Oqim hozircha mavjud emas."
        );
        setState("error");
        return;
      }
      setStreamUrl(json.streamUrl);
      setState("ready");
    } catch {
      setErrorMessage("Ulanishda xatolik yuz berdi.");
      setState("error");
    }
  };

  useEffect(() => {
    load();
    const handleOffline = () => setState("offline");
    const handleOnline = () => load();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchStreamId]);

  const isHls = streamUrl?.toLowerCase().includes(".m3u8");

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-bg-panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <span className="text-[13px] font-semibold">▶ {providerName}</span>
          <button onClick={onClose} aria-label="Yopish" className="p-1.5 rounded-md hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="aspect-video bg-black flex items-center justify-center">
          {state === "loading" && (
            <div className="flex flex-col items-center gap-2 text-muted">
              <Loader2 size={28} className="animate-spin text-accent" />
              <span className="text-[13px]">Yuklanmoqda…</span>
            </div>
          )}

          {state === "offline" && (
            <div className="flex flex-col items-center gap-3 text-muted text-center px-6">
              <WifiOff size={28} />
              <span className="text-[13px]">Internet aloqasi yo'q. Aloqa tiklanganda avtomatik urinib ko'riladi.</span>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 text-muted text-center px-6">
              <AlertCircle size={28} className="text-danger" />
              <span className="text-[13px]">{errorMessage}</span>
              <button onClick={load} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[12px] font-semibold text-white">
                <RotateCcw size={13} /> Qayta urinish
              </button>
            </div>
          )}

          {state === "ready" && streamUrl && (
            isHls ? (
              <video controls autoPlay className="w-full h-full" src={streamUrl}>
                Brauzeringiz video formatini qo'llab-quvvatlamaydi.
              </video>
            ) : (
              <iframe src={streamUrl} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
            )
          )}
        </div>
      </div>
    </div>
  );
}
