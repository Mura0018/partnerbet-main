import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { buildThemeCssVars } from "@/lib/theme";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://couponbet.org";
const DEFAULT_SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "WINORA";
const DEFAULT_DESCRIPTION = "Daily football analytics, live scores, match insights and APK access.";

async function loadSiteSettings() {
  try {
    const supabase = createPublicServerClient();
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["site_identity", "seo_defaults", "theme"]);

    const byKey = Object.fromEntries((data ?? []).map((row) => [row.key, row.value as any]));
    return {
      siteIdentity: byKey.site_identity ?? {},
      seoDefaults: byKey.seo_defaults ?? {},
      theme: byKey.theme ?? {},
    };
  } catch {
    // Supabase not configured yet (e.g. first local run before .env.local
    // is filled in) — fall back to static defaults rather than crashing.
    return { siteIdentity: {}, seoDefaults: {}, theme: {} };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteIdentity, seoDefaults } = await loadSiteSettings();
  const siteName = siteIdentity.site_name?.trim() || DEFAULT_SITE_NAME;
  const description = seoDefaults.default_description?.trim() || DEFAULT_DESCRIPTION;
  const title = seoDefaults.default_title?.trim() || `${siteName} — Football Analytics & Live Scores`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${siteName}` },
    description,
    robots: { index: true, follow: true },
    openGraph: { title, description, type: "website", url: SITE_URL, siteName },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111F",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme, siteIdentity } = await loadSiteSettings();
  const themeStyle = buildThemeCssVars(theme);
  const siteName = siteIdentity.site_name?.trim() || DEFAULT_SITE_NAME;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
  };

  return (
    <html lang="en">
      <head>
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      </head>
      <body className="bg-bg text-white antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
