import type { Metadata } from "next";

// app/support/page.tsx is a Client Component (interactive donation form),
// and Client Components cannot export `metadata` directly in the App
// Router — this Server Component layout provides it for the whole
// /support segment instead.
export const metadata: Metadata = {
  title: "Support WINORA",
  description: "Support WINORA through secure, official donation methods — one-time donations via card, PayPal, or crypto.",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
