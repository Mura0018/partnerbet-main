"use client";

import React, { useEffect, useState } from "react";
import { Gift, ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { PromoCodeButton } from "@/lib/ui/PromoCodeButton";

type Promo = { code: string; description: string | null; link: string | null; expires_at: string | null };

// MURAWIN promo bloki — bosh ekran (banner ostida) va Bonus ekranida (tepada).
// Yagona manba: /api/telegram/miniapp/promo-code (site_settings 'promo_referral').
// Aksiya o'chiq / muddat o'tgan bo'lsa API null qaytaradi — blok UMUMAN
// chizilmaydi (bo'sh joy ham qolmaydi: promo yo'q -> return null).
export function PromoCodeCard() {
  const { t } = useLocale();
  const [promo, setPromo] = useState<Promo | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/telegram/miniapp/promo-code")
      .then((r) => r.json())
      .then((d) => { if (alive) setPromo(d.promo ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Yuklanmagan yoki aksiya faol emas -> hech narsa (bo'sh joy yo'q).
  if (!promo || !promo.code) return null;

  const openLink = () => {
    if (!promo.link) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) tg.openLink(promo.link);
    else window.open(promo.link, "_blank");
  };

  return (
    <div
      className="mt-3.5 rounded-2xl border border-[var(--border-subtle)] overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(18,217,160,0.10), rgba(34,211,238,0.05))" }}
    >
      <div className="px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Gift size={14} style={{ color: "var(--gold)" }} />
          <span className="text-[12px] font-bold tracking-wide" style={{ color: "var(--ink-2)" }}>{t("tg.promoHeading")}</span>
        </div>

        {/* Kod + nusxa — nusxa mantiqi PromoCodeButton'da (yagona manba) */}
        <PromoCodeButton
          code={promo.code}
          track={false}
          big
          codeClassName="m-promocode-3d"
          copyLabel={t("tg.copy")}
          copiedLabel={t("tg.copied")}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-white/[0.05] active:bg-white/[0.08] transition text-left"
        />

        {promo.description && (
          <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>{promo.description}</p>
        )}

        {promo.link && (
          <button
            onClick={openLink}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold active:translate-y-[1px] transition-all"
            style={{ background: "linear-gradient(120deg, var(--em), #0fae80)", color: "#04231F", boxShadow: "0 8px 20px rgba(18,217,160,0.28)" }}
          >
            {t("tg.registerBtn")} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
