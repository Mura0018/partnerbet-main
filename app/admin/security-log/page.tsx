"use client";

import { useEffect, useState } from "react";
import { Loader2, Ban, Unlock } from "lucide-react";

type SecurityEvent = {
  id: string;
  createdAt: string;
  identifier: string;
  ip: string | null;
  device: string;
  success: boolean;
  risk: "high" | "medium" | "low";
  description: string;
  isBlocked: boolean;
};

type BlockedIp = { ip_address: string; reason: string | null; blocked_at: string; expires_at: string | null };

const RISK_STYLE: Record<SecurityEvent["risk"], string> = {
  high: "border-[#FF6B85]/30 bg-[#FF6B85]/[0.06]",
  medium: "border-[#F4C76A]/30 bg-[#F4C76A]/[0.06]",
  low: "border-white/8 bg-white/[0.02]",
};

export default function SecurityLogPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");
  const [actingIp, setActingIp] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/security-log");
    const data = await res.json();
    setEvents(data.events ?? []);
    setBlocked(data.blockedIps ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const blockIp = async (ip: string) => {
    if (!confirm(`${ip} manzilini bloklashni tasdiqlaysizmi? Bu manzildan hech kim tizimga kira olmaydi.`)) return;
    setActingIp(ip);
    try {
      await fetch("/api/admin/security-log/block-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, action: "block", reason: "Xavfsizlik jurnalidan bloklandi" }),
      });
      await load();
    } finally {
      setActingIp(null);
    }
  };

  const unblockIp = async (ip: string) => {
    setActingIp(ip);
    try {
      await fetch("/api/admin/security-log/block-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, action: "unblock" }),
      });
      await load();
    } finally {
      setActingIp(null);
    }
  };

  const filtered = events.filter((e) => filter === "all" || e.risk === filter);
  const highCount = events.filter((e) => e.risk === "high").length;
  const mediumCount = events.filter((e) => e.risk === "medium").length;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-[22px] font-bold mb-1">Xavfsizlik jurnali</h1>
      <p className="text-[13px] text-muted mb-6">
        So'nggi 7 kunlik kirish urinishlari — oddiy tilda. Xavfli holatlarda darhol chora ko'rishingiz mumkin.
      </p>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-[#FF6B85]/25 bg-[#FF6B85]/[0.06] p-4">
              <div className="text-[22px] font-extrabold text-[#FF6B85]">{highCount}</div>
              <div className="text-[11px] text-muted mt-0.5">Xavfli holat</div>
            </div>
            <div className="rounded-xl border border-[#F4C76A]/25 bg-[#F4C76A]/[0.06] p-4">
              <div className="text-[22px] font-extrabold text-[#F4C76A]">{mediumCount}</div>
              <div className="text-[11px] text-muted mt-0.5">Tekshirish kerak</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="text-[22px] font-extrabold">{blocked.length}</div>
              <div className="text-[11px] text-muted mt-0.5">Bloklangan IP</div>
            </div>
          </div>

          {blocked.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-6">
              <div className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-3">Bloklangan IP manzillar</div>
              <div className="space-y-2">
                {blocked.map((b) => (
                  <div key={b.ip_address} className="flex items-center justify-between gap-3 text-[13px]">
                    <div className="min-w-0">
                      <div>
                        <span className="font-mono font-semibold">{b.ip_address}</span>
                        <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded-full border ${b.expires_at ? "text-[#F4C76A] border-[#F4C76A]/30 bg-[#F4C76A]/10" : "text-[#FF6B85] border-[#FF6B85]/30 bg-[#FF6B85]/10"}`}>
                          {b.expires_at ? `${new Date(b.expires_at).toLocaleString()} gacha` : "Doimiy"}
                        </span>
                      </div>
                      {b.reason && <div className="text-[11px] text-muted mt-0.5">{b.reason}</div>}
                    </div>
                    <button
                      onClick={() => unblockIp(b.ip_address)}
                      disabled={actingIp === b.ip_address}
                      className="shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white disabled:opacity-50"
                    >
                      <Unlock size={12} /> Blokdan chiqarish
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${filter === "all" ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
            >
              Barchasi
            </button>
            <button
              onClick={() => setFilter("high")}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${filter === "high" ? "bg-[#FF6B85]/15 border-[#FF6B85] text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
            >
              Xavfli
            </button>
            <button
              onClick={() => setFilter("medium")}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${filter === "medium" ? "bg-[#F4C76A]/15 border-[#F4C76A] text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
            >
              Tekshirish kerak
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
              Bu toifada hodisa yo'q.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <div key={e.id} className={`rounded-xl border p-3.5 ${RISK_STYLE[e.risk]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px]">{e.description}</div>
                      <div className="text-[11px] text-muted mt-1">
                        {new Date(e.createdAt).toLocaleString()} · IP: {e.ip ?? "noma'lum"} · {e.device}
                      </div>
                    </div>
                    {e.ip && !e.isBlocked && (e.risk === "high" || e.risk === "medium") && (
                      <button
                        onClick={() => blockIp(e.ip!)}
                        disabled={actingIp === e.ip}
                        className="shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] hover:bg-[#FF6B85]/25 disabled:opacity-50"
                      >
                        {actingIp === e.ip ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} IP'ni bloklash
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
