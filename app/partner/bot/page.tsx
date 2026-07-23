"use client";

import React, { useEffect, useState } from "react";
import { Bot, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";

export default function PartnerBotPage() {
  const supabase = createClient();
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("partner_members").select("partner_role, partners(bot_username)").eq("profile_id", user.id).maybeSingle();
    setUsername((data as any)?.partners?.bot_username ?? null);
    setRole((data as any)?.partner_role ?? "");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setError("");
    if (!token.trim()) { setError("Bot tokenini kiriting."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/partner/bot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.trim() }) });
      const data = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = { invalid_token: "Token noto'g'ri — BotFather'dan tekshiring.", telegram_unreachable: "Telegram bilan ulanib bo'lmadi. Qayta urining.", forbidden: "Faqat partner admin botni ulaydi." };
        const msg = map[data.error] ?? "Xatolik yuz berdi.";
        setError(msg);
        toast.error("Bot ulanmadi: " + msg);
        return;
      }
      setToken("");
      setUsername(data.username || "");
      toast.success(`Bot ulandi ✅ @${data.username || ""}`);
    } catch { setError("Ulanishda xatolik."); toast.error("Ulanishda xatolik. Internetni tekshiring."); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!confirm("Botni uzishni tasdiqlaysizmi?")) return;
    setBusy(true);
    try {
      await fetch("/api/partner/bot", { method: "DELETE" });
      setUsername(null);
      toast.success("Bot uzildi");
    } finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  const isAdmin = role === "partner_admin";

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Bot size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Bot</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">O'z Telegram botingizni ulang — mijozlaringiz shu bot orqali kiradi.</p>

      {username ? (
        <div className="rounded-xl border border-[#4ADE80]/30 bg-[#4ADE80]/10 p-5 mb-5 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-[#4ADE80] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold">Bot ulangan</div>
            <div className="text-[12px] text-muted">@{username}</div>
          </div>
          {isAdmin && <button onClick={disconnect} disabled={busy} className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white">Uzish</button>}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-5">
          {isAdmin ? (
            <>
              <label className="block text-[12px] text-muted mb-1.5">Bot tokeni (@BotFather → /newbot)</label>
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:AA...." className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-[13px] outline-none focus:border-accent mb-3 font-mono" />
              {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
              <button onClick={connect} disabled={busy} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Ulash"}
              </button>
            </>
          ) : (
            <p className="text-[13px] text-muted">Bot hali ulanmagan. Faqat partner admin ulay oladi.</p>
          )}
        </div>
      )}

      <div className="flex items-start gap-2.5 text-[12px] text-muted">
        <ShieldCheck size={16} className="text-[#4ADE80] shrink-0 mt-0.5" />
        <span>Tokeningiz maxfiy saqlanadi — qayta ko'rsatilmaydi va hech kim (biz ham) ko'ra olmaydi.</span>
      </div>
    </div>
  );
}
