"use client";

import React, { useEffect, useState } from "react";
import { Heart, Copy, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card } from "@/lib/ui/primitives";
import { Button } from "@/lib/ui/Button";

type PaymentMethod = {
  id: string; key: string; name: string; method_type: "gateway" | "crypto";
  provider_key: string | null; crypto_symbol: string | null; network: string | null; wallet_address: string | null;
};

const SUGGESTED_AMOUNTS = [5, 10, 25, 50, 100];

export default function SupportPage() {
  const { t } = useLocale();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cryptoReported, setCryptoReported] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("payment_methods").select("*").eq("is_active", true).order("display_order");
      setMethods((data as PaymentMethod[]) ?? []);
      if (data && data.length > 0) setSelectedMethod(data[0] as PaymentMethod);
    })();
  }, []);

  useEffect(() => {
    setQrDataUrl(null);
    setCryptoReported(false);
    if (selectedMethod?.method_type === "crypto" && selectedMethod.wallet_address) {
      (async () => {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(selectedMethod.wallet_address!, { margin: 1, width: 220 });
        setQrDataUrl(url);
      })();
    }
  }, [selectedMethod]);

  const finalAmount = customAmount ? Number(customAmount) : amount;

  const copyAddress = async () => {
    if (!selectedMethod?.wallet_address) return;
    try {
      await navigator.clipboard.writeText(selectedMethod.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const submitGatewayDonation = async () => {
    setError("");
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) { setError(t("donations.invalidAmount")); return; }
    if (!selectedMethod) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: selectedMethod.id, amount: finalAmount, currency: "USD",
          donorName, message, isAnonymous, isPublic,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.checkoutUrl) { setError(json.error ?? t("donations.genericError")); setSubmitting(false); return; }
      window.location.href = json.checkoutUrl;
    } catch {
      setError(t("donations.genericError"));
      setSubmitting(false);
    }
  };

  const submitCryptoReport = async () => {
    setError("");
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) { setError(t("donations.invalidAmount")); return; }
    if (!selectedMethod) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/donations/crypto-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: selectedMethod.id, amount: finalAmount, currency: selectedMethod.crypto_symbol ?? "USD",
          donorName, message, isAnonymous, isPublic,
        }),
      });
      if (!res.ok) { const json = await res.json(); setError(json.error ?? t("donations.genericError")); setSubmitting(false); return; }
      setCryptoReported(true);
    } catch {
      setError(t("donations.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-14 max-w-2xl">
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-cta to-cta-dim flex items-center justify-center shadow-[0_0_24px_rgba(23,201,100,0.35)] mb-4">
            <Heart size={22} className="text-white" fill="white" />
          </div>
          <h1 className="text-[28px] md:text-[36px] font-extrabold">{t("donations.title")}</h1>
          <p className="text-muted mt-2 text-[15px]">{t("donations.subtitle")}</p>
        </div>

        <Card className="p-6 md:p-8">
          <label className="block text-[13px] font-semibold mb-2">{t("donations.chooseAmount")}</label>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {SUGGESTED_AMOUNTS.map((a) => (
              <button key={a} onClick={() => { setAmount(a); setCustomAmount(""); }}
                className={`py-2.5 rounded-lg text-[13px] font-semibold border transition ${!customAmount && amount === a ? "bg-cta/10 text-[#5EE896] border-cta/40" : "border-white/10 text-muted hover:border-white/20"}`}>
                ${a}
              </button>
            ))}
          </div>
          <input
            type="number" min={1} placeholder={t("donations.customAmount")} value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-6"
          />

          <label className="block text-[13px] font-semibold mb-2">{t("donations.choosePaymentMethod")}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {methods.map((m) => (
              <button key={m.id} onClick={() => setSelectedMethod(m)}
                className={`py-2.5 px-3 rounded-lg text-[13px] font-medium border transition text-left ${selectedMethod?.id === m.id ? "bg-accent/10 text-accent border-accent/40" : "border-white/10 text-muted hover:border-white/20"}`}>
                {m.name}
              </button>
            ))}
            {methods.length === 0 && <p className="text-[12px] text-muted col-span-full">To'lov usullari hozircha sozlanmagan.</p>}
          </div>

          {selectedMethod?.method_type === "crypto" && selectedMethod.wallet_address && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 mb-6 text-center">
              <p className="text-[12px] text-muted mb-3">{t("donations.cryptoInstructions")}</p>
              {qrDataUrl && <img src={qrDataUrl} alt="QR" className="mx-auto mb-3 rounded-lg" width={180} height={180} />}
              <div className="flex items-center gap-2 justify-center">
                <code className="text-[12px] bg-black/30 px-3 py-2 rounded-lg break-all">{selectedMethod.wallet_address}</code>
                <button onClick={copyAddress} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 shrink-0" aria-label={t("donations.copyAddress")}>
                  {copied ? <Check size={15} className="text-cta" /> : <Copy size={15} />}
                </button>
              </div>
              {selectedMethod.network && <p className="text-[11px] text-muted mt-2">Network: {selectedMethod.network}</p>}
            </div>
          )}

          <label className="block text-[13px] font-semibold mb-2">{t("donations.donorName")}</label>
          <input value={donorName} onChange={(e) => setDonorName(e.target.value)} disabled={isAnonymous}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-4 disabled:opacity-50" />

          <label className="block text-[13px] font-semibold mb-2">{t("donations.message")}</label>
          <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-4" />

          <div className="flex flex-col gap-2 mb-6">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} /> {t("donations.anonymous")}
            </label>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} disabled={isAnonymous} /> {t("donations.showPublicly")}
            </label>
          </div>

          {error && <p className="text-[12px] text-danger mb-4">{error}</p>}

          {selectedMethod?.method_type === "crypto" ? (
            cryptoReported ? (
              <p className="text-[13px] text-cta text-center font-semibold">{t("donations.thankYouMessage")}</p>
            ) : (
              <Button onClick={submitCryptoReport} variant="cta" size="lg" className="w-full" disabled={submitting || !selectedMethod}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null} {t("donations.reportSent")}
              </Button>
            )
          ) : (
            <Button onClick={submitGatewayDonation} variant="cta" size="lg" className="w-full" disabled={submitting || !selectedMethod}>
              {submitting ? t("donations.processing") : t("donations.donateNow")}
            </Button>
          )}
        </Card>
      </Container>
      <PublicFooter />
    </div>
  );
}
