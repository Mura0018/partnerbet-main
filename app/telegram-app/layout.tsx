import React from "react";
import "./theme.css";

// Mini-app segment layout — yangi dizayn tokenlari (.miniapp-root) va
// fon qatlamlari (aurora + grain) shu yerda, page.tsx tuzilishiga tegmasdan.
// Eski app-theme (classic/neon/royal) buzilmaydi — yonma-yon ishlaydi.
export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="miniapp-root">
      <div className="miniapp-aurora" aria-hidden="true" />
      <div className="miniapp-grain" aria-hidden="true" />
      {children}
    </div>
  );
}
