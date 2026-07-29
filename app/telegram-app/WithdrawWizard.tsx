"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Loader2, CheckCircle2, ShieldCheck, AlertTriangle, ChevronRight } from "lucide-react";

// W2: bosqichли pul yechish — YANGI tartib (W2.1): ID -> summa -> REKVIZIT
// -> kod -> buyurtma. Mijoz endi cashdeskPayout'ni HECH QACHON
// chaqirmaydi (W2.2) — payout faqat operator "1xbetdan yechib olish"
// tugmasini bosganda, server tomonda ishga tushadi. Buyurtma yaratilganda
// uning ichida ALLAQACHON bor: kim (playerName), qancha (amount), qaysi
// kartaga (payoutDetails/recipientName) — rekvizitsiz buyurtma
// yaratilmaydi.
//  1) Platforma + ID -> tekshirish (F.I.Sh. keladi)
//  2) Summa
//  3) Rekvizit: usul + hisob raqami + F.I.Sh. (avto, tahrirlanadi)
//  4) 4 xonali kod -> buyurtma yaratiladi (POST /orders) — pul HALI
//     ko'chmagan, operator ko'rib chiqmoqda holatida turadi.
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
  const [confirmId, setConfirmId] = useState(false);

  const [platform, setPlatform] = useState("1xBet");
  const [customPlatform, setCustomPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [amount, setAmount] = useState("");

  const [method, setMethod] = useState("card");
  const [recipient, setRecipient] = useState("");
  const [details, setDetails] = useState("");

  const [code, setCode] = useState("");

  // W1.4: full_name bo'sh mijozdan bir marta so'raladi.
  const [needsFullName, setNeedsFullName] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [savingFullName, setSavingFullName] = useState(false);

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
        if (d.error === "not_configured") {
          setConfirmId(true);
          return;
        }
        setError(d.error === "not_found" ? t("wz.eIdNotFound") : t("wz.eVerify"));
        return;
      }
      setPlayerName(d.playerName ?? "");
      setRecipient(d.playerName ?? "");
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  // 2-qadam: summa
  const confirmAmount = () => {
    setError("");
    if (!amount || Number(amount) <= 0) { setError(t("tg.eAmount")); return; }
    setStep(3);
  };

  // 3-qadam: rekvizit
  const confirmRequisite = () => {
    setError("");
    if (!details.trim()) { setError(t("wz.eDetails")); return; }
    if (!recipient.trim()) { setError(t("wz.eRecipient")); return; }
    setStep(4);
  };

  // 4-qadam: kod -> buyurtma yaratiladi (pul HALI ko'chmagan)
  const submitOrder = async () => {
    setError("");
    if (!code.trim()) { setError(t("wz.eCode")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/miniapp/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData: getInitData(), type: "withdraw", platform: realPlatform, accountId: accountId.trim(),
          amount: Number(amount), paymentMethod: method, withdrawCode: code.trim(),
          payoutDetails: details.trim(), recipientName: recipient.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.error === "withdraw_disabled") setError(t("wz.eWithdrawOff"));
        else if (d.error === "too_many_pending_orders") setError(t("wz.ePending"));
        else if (d.error === "player_not_found") setError(t("wz.ePlayerNF"));
        else if (d.error === "temporarily_blocked") setError(t("wz.eBlocked"));
        else if (d.error === "full_name_required") setNeedsFullName(true);
        else if (d.error === "name_mismatch") setError(t("wz.eNameMismatch"));
        else if (d.error === "order_limit_exceeded") setError(`${t("wz.eGeneric")} (limit: ${Number(d.limit).toLocaleString("ru-RU")})`);
        else if (d.error === "daily_limit_exceeded") setError(`${t("wz.eGeneric")} (limit: ${Number(d.limit).toLocaleString("ru-RU")})`);
        else setError(t("wz.eGeneric"));
        return;
      }
      onDone();
    } catch {
      setError(t("wz.eGeneric"));
    } finally {
      setBusy(false);
    }
  };

  // W1.4: ism yuborilgach, buyurtma yaratish avtomatik qayta urinadi.
  const submitFullNameAndRetry = async () => {
    if (!fullNameInput.trim()) {
      setError(t("tg.eNameRequired"));
      return;
    }
    setSavingFullName(true);
    setError("");
    try {
      const res = await fetch("/api/telegram/miniapp/set-full-name", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: getInitData(), fullName: fullNameInput.trim() }),
      });
      if (!res.ok) {
        setError(t("wz.eGeneric"));
        return;
      }
      setNeedsFullName(false);
      await submitOrder();
    } catch {
      setError(t("wz.eGeneric"));
    } finally {
      setSavingFullName(false);
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

      {step === 1 && confirmId && (
        <div>
          <div className="mb-4 rounded-xl bg-accent/10 border border-accent/25 px-4 py-4 text-center">
            <div className="text-[26px] font-extrabold tracking-wide mb-2">{accountId.trim()}</div>
            <div className="text-[13px] text-[#93a5ba]">{t("wz.idConfirmMsg", { id: accountId.trim() })}</div>
          </div>
          <button type="button" onClick={() => { setConfirmId(false); setPlayerName(""); setRecipient(""); setStep(2); }} className={buttonCls}>
            {t("wz.continueBtn")}
          </button>
          <button type="button" onClick={() => setConfirmId(false)} className="w-full mt-2 py-2.5 text-[13px] text-[#93a5ba]">
            {t("wz.idChange")}
          </button>
        </div>
      )}

      {step === 1 && !confirmId && (
        <div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.platform")}</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" onClick={() => setPlatform(p)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${platform === p ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] m-divider text-[#93a5ba]"}`}>{p === "Boshqa" ? t("tg.platformOther") : p}</button>
            ))}
          </div>
          {platform === "Boshqa" && <input className={`${inputCls} mb-3`} placeholder={t("wz.platformPh")} value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)} />}
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.accId")}</label>
          <input className={`${inputCls} mb-2`} placeholder={t("wz.accIdPh")} value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={verifyId} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<><ShieldCheck size={16} /> {t("wz.verify")}</>)}</button>
        </div>
      )}

      {step === 2 && needsFullName && (
        <div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.fullNamePrompt")}</label>
          <input className={`${inputCls} mb-2`} placeholder={t("tg.fullNamePh")} value={fullNameInput} onChange={(e) => setFullNameInput(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={submitFullNameAndRetry} disabled={savingFullName} className={buttonCls}>{savingFullName ? <Loader2 size={16} className="animate-spin" /> : t("tg.submitName")}</button>
        </div>
      )}

      {step === 2 && !needsFullName && (
        <div>
          {playerName && <div className="flex items-center gap-2 mb-3 text-[13px] text-[#4ADE80]"><CheckCircle2 size={15} /> {t("wz.player")} <b>{playerName}</b></div>}
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("tg.sum")}</label>
          <input className={`${inputCls} mb-2`} type="number" min={1} placeholder={t("tg.phSum")} value={amount} onChange={(e) => setAmount(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={confirmAmount} className={buttonCls}>{t("wz.continueBtn")} <ChevronRight size={16} /></button>
        </div>
      )}

      {step === 3 && (
        <div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.receiveMethod")}</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {METHODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`py-2.5 rounded-xl text-[13px] font-semibold border ${method === m.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.03] m-divider text-[#93a5ba]"}`}>{m.label}</button>
            ))}
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.recipient")}</label>
          <input className={`${inputCls} mb-3`} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t("wz.recipientPh")} />
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.recipientReq")}</label>
          <input className={`${inputCls} mb-2`} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("wz.recipientReqPh")} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={confirmRequisite} className={buttonCls}>{t("wz.continueBtn")} <ChevronRight size={16} /></button>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="rounded-xl bg-white/[0.03] border m-divider px-3.5 py-2.5 mb-3 text-[12px] text-[#93a5ba]">
            {t("wz.sumLabel")} <b className="text-white">{Number(amount).toLocaleString("ru-RU")} {t("wz.sumUnit")}</b> · {t("wz.methodLabel")} <b className="text-white">{METHODS.find((m) => m.id === method)?.label}</b>
          </div>
          <div className="rounded-xl bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 mb-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-[#F4C76A] shrink-0 mt-0.5" />
            <span className="text-[11.5px] text-[#F4C76A]">{t("wz.payoutWarn")}</span>
          </div>
          <label className="block text-[12px] text-[#93a5ba] mb-1.5">{t("wz.code")}</label>
          <input className={`${inputCls} mb-2`} placeholder={t("wz.codePh")} value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="text-[12px] text-[#FF6B85] mb-2">{error}</p>}
          <button onClick={submitOrder} disabled={busy} className={buttonCls}>{busy ? <Loader2 size={16} className="animate-spin" /> : (<>{t("wz.confirm")} <ChevronRight size={16} /></>)}</button>
        </div>
      )}
    </div>
  );
}
