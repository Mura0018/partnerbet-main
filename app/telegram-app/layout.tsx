import React from "react";
import "./theme.css";
import { getTimezone } from "@/lib/site/timezone";
import { SiteTimezoneProvider } from "@/lib/site/SiteTimezoneProvider";

// Mini-app segment layout — yangi dizayn tokenlari (.miniapp-root) va
// fon qatlamlari (aurora + grain) shu yerda, page.tsx tuzilishiga tegmasdan.
// Eski app-theme (classic/neon/royal) buzilmaydi — yonma-yon ishlaydi.
// F2a: server komponent -> site vaqt mintaqasini SSR bilan uzatadi (mijoz
// qayerda bo'lishidan qat'i nazar buyurtma vaqti site mintaqasida ko'rinadi).
export default async function MiniAppLayout({ children }: { children: React.ReactNode }) {
  const tz = await getTimezone();
  return (
    <SiteTimezoneProvider tz={tz}>
      <div className="miniapp-root">
        <div className="miniapp-aurora" aria-hidden="true" />
        <div className="miniapp-grain" aria-hidden="true" />
        {children}
      </div>
    </SiteTimezoneProvider>
  );
}
