"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

function SetPasswordInner() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false); // Supabase email havolasi orqali kelgan sessiya
  const supabase = createClient();

  // Supabase parol-tiklash havolasi orqali kelgan bo'lsa — sessiya bo'ladi.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) setRecovery(true);
      } catch { /* ignore */ }
      setReady(true);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8) { setError("Parol kamida 8 belgi bo'lsin."); return; }
    if (pw !== pw2) { setError("Parollar mos kelmadi."); return; }
    setBusy(true);
    try {
      if (recovery) {
        // Supabase email havolasi: joriy sessiya orqali parolni yangilaymiz.
        const { error: upErr } = await supabase.auth.updateUser({ password: pw });
        if (upErr) { setError("Xatolik: " + upErr.message); return; }
        setDone(true);
      } else if (token) {
        // Admin bergan havola (eski token oqimi).
        const res = await fetch("/api/partner/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password: pw }),
        });
        const data = await res.json();
        if (!res.ok) {
          const map: Record<string, string> = {
            invalid_or_expired: "Havola yaroqsiz yoki muddati tugagan. Admindan yangi havola so'rang.",
            weak_password: "Parol kamida 8 belgi bo'lsin.",
            rate_limited: "Juda ko'p urinish. Birozdan so'ng qayta urining.",
          };
          setError(map[data.error] ?? "Xatolik yuz berdi.");
          return;
        }
        setDone(true);
      } else {
        setError("Havola noto'g'ri.");
      }
    } catch {
      setError("Ulanishda xatolik. Qayta urining.");
    } finally {
      setBusy(false);
    }
  };

  const wrap = "min-h-[100svh] flex items-center justify-center p-6 bg-gradient-to-b from-[#123f77] via-[#0f3364] to-[#0a1a30] text-white";

  if (!ready) {
    return <div className={wrap}><Loader2 size={22} className="animate-spin text-[#93a5ba]" /></div>;
  }
  if (!token && !recovery) {
    return <div className={wrap}><div className="text-center text-[14px] text-[#93a5ba] flex items-center gap-2"><AlertTriangle size={18} /> Havola noto'g'ri yoki muddati tugagan.</div></div>;
  }

  return (
    <div className={wrap}>
      <style>{`@keyframes spFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes spGlow{0%,100%{box-shadow:0 0 30px 4px rgba(61,127,255,.35)}50%{box-shadow:0 0 46px 10px rgba(124,58,237,.4)}}@keyframes spRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="w-full max-w-sm" style={{ animation: "spRise .5s ease both" }}>
        <div className="rounded-3xl p-6 border border-white/10" style={{ background: "linear-gradient(160deg,#173a68,#0e2038)", boxShadow: "12px 12px 30px rgba(0,0,0,0.5),-6px -6px 20px rgba(120,180,255,0.08)" }}>
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-[#4ADE80] mx-auto mb-4" />
              <h1 className="text-[18px] font-extrabold mb-1.5">Parol o'rnatildi ✅</h1>
              <div className="rounded-xl bg-[#F4C76A]/10 border border-[#F4C76A]/30 text-[#F4C76A] text-[12.5px] px-3.5 py-3 my-4 flex items-start gap-2 text-left">
                <KeyRound size={16} className="shrink-0 mt-0.5" />
                <span><b>Parolingizni saqlab qo'ying!</b> Uni hech kimga bermang. Unutsangiz — admin yangi havola beradi.</span>
              </div>
              <Link href="/partner" className="inline-block w-full py-3 rounded-xl bg-gradient-to-r from-accent to-accent-dim font-bold text-[14px]">Panelga kirish</Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-[#7c3aed] flex items-center justify-center mb-4" style={{ animation: "spFloat 3.4s ease-in-out infinite, spGlow 4s ease-in-out infinite" }}>
                  <Lock size={28} className="text-white" />
                </div>
                <h1 className="text-[19px] font-extrabold">Parolingizni yarating</h1>
                <p className="text-[12.5px] text-[#93a5ba] mt-1">Hamkorlik paneliga kirish uchun parol o'rnating.</p>
              </div>
              <form onSubmit={submit}>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Yangi parol (kamida 8 belgi)" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-[14px] outline-none focus:border-accent mb-2.5" />
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Parolni takrorlang" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-3.5 text-[14px] outline-none focus:border-accent mb-3" />
                {error && <p className="text-[12.5px] text-[#FF6B85] mb-3">{error}</p>}
                <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-accent to-accent-dim font-bold text-[15px] disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Parolni saqlash"}
                </button>
              </form>
              <div className="flex items-center gap-2 mt-4 text-[11.5px] text-[#93a5ba]">
                <ShieldCheck size={15} className="text-[#4ADE80] shrink-0" />
                <span>Parolingiz xavfsiz saqlanadi — hech kim (biz ham) ko'ra olmaydi.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100svh] bg-[#0a1a30]" />}>
      <SetPasswordInner />
    </Suspense>
  );
}
