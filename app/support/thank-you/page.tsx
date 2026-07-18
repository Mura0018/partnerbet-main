"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container } from "@/lib/ui/primitives";
import { Button } from "@/lib/ui/Button";

export default function ThankYouPage() {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-20 max-w-lg text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cta to-cta-dim flex items-center justify-center shadow-[0_0_30px_rgba(23,201,100,0.4)] mb-6">
          <CheckCircle2 size={28} className="text-white" />
        </div>
        <h1 className="text-[28px] font-extrabold mb-3">{t("donations.thankYouTitle")}</h1>
        <p className="text-muted text-[15px] mb-8">{t("donations.thankYouMessage")}</p>
        <Button href="/" variant="primary" size="md">{t("donations.backHome")}</Button>
      </Container>
      <PublicFooter />
    </div>
  );
}
