"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useLocale();
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
    if (!realPlatform || !accountId.trim()) { setError(t("wz.ePlatformId")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/verify-player", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), accountId: accountId.trim() }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error === "not_found" ? t("wz.eIdNotFound") : d.error === "not_configured" ? t("wz.eCdOff") : t("wz.eVerify"));
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
    if (!code.trim()) { setError(t("wz.eCode")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/withdraw/payout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), platform: realPlatform, accountId: accountId.trim(), code: code.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        if (d.error === "payout_failed") setError(t("wz.ePayout"));
        else if (d.error === "withdraw_disabled") setError(t("wz.eWithdrawOff"));
        else if (d.error === "too_many_pending_orders") setError(t("wz.ePending"));
        else if (d.error === "player_not_found") setError(t("wz.ePlayerNF"));
        else setError(t("wz.eGeneric"));
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
    if (!details.trim()) { setError(t("wz.eDetails")); return; }
    if (!recipient.trim()) { setError(t("wz.eRecipient")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/withdraw/details", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), orderId, paymentMethod: method, payoutDetails: details.trim(), recipientName: recipient.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) { setError(t("wz.eFinish")); return; }
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
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.platform")}</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => setPlatform(p)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${platform === p ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"}`}>{p}</button>
            ))}
          </div>
          {platform === "Boshqa" && <input className={`${inputCls} mb-3`} placeholder={t("wz.platformPh")} value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)} />}
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.accId")}</label>
          <input className={`${inputCls} mb-2`} placeholder={t("wz.accIdPh")} value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={verifyId} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<><ShieldCheck size={16} /> {t("wz.verify")}</>)}</button>
        </div>
      )}

      {step === 2 && (
        <div>
          {playerName && <div className="flex items-center gap-2 mb-3 text-[13px] text-[#4ADE80]"><CheckCircle2 size={15} /> {t("wz.player")} <b>{playerName}</b></div>}
          <div className="rounded-xl bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 mb-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-[#F4C76A] shrink-0 mt-0.5" />
            <span className="text-[11.5px] text-[#F4C76A]">{t("wz.payoutWarn")}</span>
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.code")}</label>
          <input className={`${inputCls} mb-2`} placeholder={t("wz.codePh")} value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={confirmCode} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<>{t("wz.confirm")} <ChevronRight size={16} /></>)}</button>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-3.5 py-3 mb-4 text-center">
            <div className="text-[11px] text-[#4ADE80]">{t("wz.withdrawn")}</div>
            <div className="text-[22px] font-extrabold text-white">{summa.toLocaleString("ru-RU")} {t("wz.sumUnit")}</div>
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.receiveMethod")}</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {METHODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${method === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] border-white/10 text-[#93a5ba]"}`}>{m.label}</button>
            ))}
          </div>
          <button onClick={() => setStep(4)} className={buttonCls}>{t("wz.continueBtn")} <ChevronRight size={16} /></button>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 mb-3 text-[12px] text-[#93a5ba]">{t("wz.sumLabel")} <b className="text-white">{summa.toLocaleString("ru-RU")} {t("wz.sumUnit")}</b> · {t("wz.methodLabel")} <b className="text-white">{METHODS.find((m) => m.id === method)?.label}</b></div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.recipient")}</label>
          <input className={`${inputCls} mb-3`} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t("wz.recipientPh")} />
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.recipientReq")}</label>
          <input className={`${inputCls} mb-2`} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("wz.recipientReqPh")} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={finish} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : t("wz.finish")}</button>
        </div>
      )}
    </div>
  );
}
