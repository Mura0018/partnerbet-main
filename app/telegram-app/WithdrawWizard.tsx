"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle, ChevronRight } from "lucide-react";

// W2: bosqichли pul yechish (A-oqim).
//  1) Platforma + ID -> tekshirish (F.I.Sh. keladi)
//  2) 4 xonali kod -> Payout (pul 1xbetдан yechiladi) -> summa keladi
//  3) Usul tanlash
//  4) F.I.Sh. (avto, tahrirlanadi) + rekvizit -> yakunlash
const METHODS = [
  { id: "card", label: "Karta" },
  { id: "click", label: "Click" },
  { id: "payme", label: "Payme" },
  { id: "crypto", label: "USDT (TRC20)" },
];
const PLATFORMS = ["1xBet", "Melbet", "Linebet", "Boshqa"];

export function WithdrawWizard({ getInitData, onDone, inputCls, buttonCls }: { getInitData: () => string; onDone: () => void; inputCls: string; buttonCls: string }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [platform, setPlatform] = useState("1xBet");
  const [customPlatform, setCustomPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [code, setCode] = useState("");
  const [orderId, setOrderId] = useState("");
  const [summa, setSumma] = useState(0);

  const [method, setMethod] = useState("card");
  const [recipient, setRecipient] = useState("");
  const [details, setDetails] = useState("");

  const realPlatform = platform === "Boshqa" ? customPlatform.trim() : platform;

  // 1-qadam: ID tekshirish
  const verifyId = async () => {
    setError("");
    if (!realPlatform || !accountId.trim()) { setError("Platforma va ID ni kiriting."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/verify-player", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), accountId: accountId.trim() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error === "not_found" ? "Bunday hisob ID topilmadi." : d.error === "not_configured" ? "Kassa hozircha ulanmagan." : "Tekshirishда xatolik.");
        return;
      }
      setPlayerName(d.playerName ?? "");
      setRecipient(d.playerName ?? "");
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  // 2-qadam: kod -> Payout (pul yechiladi)
  const confirmCode = async () => {
    setError("");
    if (!code.trim()) { setError("Yechish kodini kiriting."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/withdraw/payout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), platform: realPlatform, accountId: accountId.trim(), code: code.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        if (d.error === "payout_failed") setError("Kod noto'g'ri yoki eskirган. 1xbet'да yangi kod oling.");
        else if (d.error === "withdraw_disabled") setError("Pul yechish hozircha vaqtincha to'xtatilgan.");
        else if (d.error === "too_many_pending_orders") setError("Sizда ko'rib chiqilayotган buyurtмалар bor. Kuting.");
        else if (d.error === "player_not_found") setError("Hisob ID topilmadi.");
        else setError("Xatolik. Qayta urinib ko'ring.");
        return;
      }
      setOrderId(d.orderId);
      setSumma(Number(d.summa) || 0);
      if (d.playerName && !recipient) setRecipient(d.playerName);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  // 4-qadam: yakunlash
  const finish = async () => {
    setError("");
    if (!details.trim()) { setError("Qabul qiluvchi raqam/karta kiriting."); return; }
    if (!recipient.trim()) { setError("Qabul qiluvchi F.I.Sh. kiriting."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/withdraw/details", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), orderId, paymentMethod: method, payoutDetails: details.trim(), recipientName: recipient.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) { setError("Yakunlashда xatolik. Qayta urinib ko'ring."); return; }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const Steps = () => (
    <div className="flex items-center gap-1.5 mb-4">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-accent" : "bg-white/10"}`} />
      ))}
    </div>
  );

  return (
    <div>
      <Steps />

      {step === 1 && (
        <div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Platforma</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => setPlatform(p)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${platform === p ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"}`}>{p}</button>
            ))}
          </div>
          {platform === "Boshqa" && <input className={`${inputCls} mb-3`} placeholder="Platforma nomi" value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)} />}
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Hisob ID</label>
          <input className={`${inputCls} mb-2`} placeholder="Masalan: 123456789" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={verifyId} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<><ShieldCheck size={16} /> Tekshirish</>)}</button>
        </div>
      )}

      {step === 2 && (
        <div>
          {playerName && <div className="flex items-center gap-2 mb-3 text-[13px] text-[#4ADE80]"><CheckCircle2 size={15} /> O'yinchi: <b>{playerName}</b></div>}
          <div className="rounded-xl bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 mb-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-[#F4C76A] shrink-0 mt-0.5" />
            <span className="text-[11.5px] text-[#F4C76A]">Kodни tasdiqlаганда pul 1xbet hisobingizдан darhol yechiladi. 1xbet ilovasида yechish kodини oling.</span>
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Yechish kodi</label>
          <input className={`${inputCls} mb-2`} placeholder="Masalan: A1b2" value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={confirmCode} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<>Tasdiqlash <ChevronRight size={16} /></>)}</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-3.5 py-3 mb-4 text-center">
            <div className="text-[11px] text-[#4ADE80]">1xbetдан yechildi</div>
            <div className="text-[22px] font-extrabold text-white">{summa.toLocaleString("ru-RU")} so'm</div>
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Pulni qabul qilish usuli</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {METHODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${method === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"}`}>{m.label}</button>
            ))}
          </div>
          <button onClick={() => setStep(4)} className={buttonCls}>Davom etish <ChevronRight size={16} /></button>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 mb-3 text-[12px] text-[#93a5ba]">Summa: <b className="text-white">{summa.toLocaleString("ru-RU")} so'm</b> · Usul: <b className="text-white">{METHODS.find((m) => m.id === method)?.label}</b></div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Qabul qiluvchi F.I.Sh. (avto to'ldirilди)</label>
          <input className={`${inputCls} mb-3`} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Masalan: Aliyev Vali" />
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">Qabul qiluvchi raqam/karta</label>
          <input className={`${inputCls} mb-2`} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Karta / Click / Payme raqami" />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={finish} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Yakunlash"}</button>
        </div>
      )}
    </div>
  );
}
