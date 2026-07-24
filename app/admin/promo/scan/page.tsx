"use client";

import React, { useEffect, useRef, useState } from "react";
import { QrCode, Loader2, Camera, X, User, Search } from "lucide-react";

type Result = {
  customer: { id: string; full_name: string | null; phone: string; created_at: string | null };
  card: { code: string; claimed_at: string };
  activity: { volume: number; orders_count: number };
  orders: { id: string; type: string; amount: number; status: string; platform: string; created_at: string }[];
  scanCount: number;
};

const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
const fmtDt = (s: string | null) => (s ? new Date(s).toLocaleString("ru-RU") : "—");
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "text-[#F4C76A]" },
  completed: { label: "Bajarildi", cls: "text-[#4ADE80]" },
  rejected: { label: "Rad etildi", cls: "text-[#FF6B85]" },
};

export default function PromoScanPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);

  const cameraSupported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  const lookup = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/promo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error === "not_found" ? "Bunday kod topilmadi. Kartani tekshiring." : "Xatolik. Qayta urinib ko'ring.");
        return;
      }
      setResult(d);
    } catch {
      setError("Ulanishда xatolik.");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    stopRef.current = true;
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setError("");
    stopRef.current = false;
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (stopRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) {
            const val = codes[0].rawValue as string;
            stopCamera();
            setCode(val);
            lookup(val);
            return;
          }
        } catch {
          /* frame o'qilmadi — davom */
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {
      setScanning(false);
      setError("Kamera ochilmadi. Ruxsat bering yoki kodni qo'lда kiriting.");
    }
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><QrCode size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">Sovrin karta skaneri</h1>
          <p className="text-xs text-white/40">Mijoz QR yoki kodini o'qing — har skaner qayd etiladi</p>
        </div>
      </div>

      {/* Kamera */}
      {scanning ? (
        <div className="relative rounded-2xl overflow-hidden border border-white/10 mb-4 bg-black">
          <video ref={videoRef} className="w-full max-h-[60vh] object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-[#1CE0C3]/70 rounded-2xl" />
          </div>
          <button onClick={stopCamera} className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white"><X size={18} /></button>
        </div>
      ) : (
        cameraSupported && (
          <button onClick={startCamera} className="w-full mb-4 py-3 rounded-2xl bg-[#1CE0C3] text-[#04231F] font-semibold flex items-center justify-center gap-2">
            <Camera size={18} /> Kamerани yoqish
          </button>
        )
      )}

      {/* Qo'lда kod */}
      <div className="flex gap-2 mb-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup(code)}
          placeholder="Karta kodini kiriting (masalan A1B2C3D4E5)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-white text-sm outline-none focus:border-accent font-mono"
        />
        <button onClick={() => lookup(code)} disabled={loading} className="px-4 rounded-lg bg-accent/20 text-white font-medium hover:bg-accent/30 disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Qidirish
        </button>
      </div>
      {!cameraSupported && <p className="text-[11px] text-white/30 mb-2">Kamera skaneri bu qurilmaда qo'llab-quvvatlanmaydi — kodni qo'lда kiriting.</p>}
      {error && <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[12.5px] px-3 py-2.5 mb-2">{error}</div>}

      {/* Natija — mijoz kuzatuvi */}
      {result && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-4 border-b border-white/8 flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-[#1CE0C3]/10 flex items-center justify-center text-[#1CE0C3]"><User size={20} /></span>
            <div className="min-w-0">
              <div className="text-white font-bold text-[15px]">{result.customer.full_name || result.customer.phone}</div>
              <div className="text-[12px] text-white/40">{result.customer.phone} · Ro'yxatdan: {fmtDt(result.customer.created_at)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">Faollik (so'm)</div>
              <div className="text-[15px] font-bold text-[#4ADE80]">{fmt(result.activity.volume)}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">Buyurtma</div>
              <div className="text-[15px] font-bold text-white">{result.activity.orders_count}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-white/40">Skaner</div>
              <div className="text-[15px] font-bold text-[#F4C76A]">{result.scanCount}</div>
            </div>
          </div>
          <div className="p-3">
            <div className="text-[11px] text-white/40 mb-1.5">So'nggi buyurtmalar</div>
            {result.orders.length === 0 ? (
              <div className="text-[12px] text-white/30 py-2">Buyurtma yo'q.</div>
            ) : (
              <div className="space-y-1.5">
                {result.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">{o.type === "topup" ? "To'ldirish" : "Yechish"} · {o.platform}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-white">{fmt(o.amount)}</span>
                      <span className={STATUS[o.status]?.cls ?? "text-white/50"}>{STATUS[o.status]?.label ?? o.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
