import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { cookiesContent } from "@/lib/legal/cookies";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: cookiesContent[locale].title, description: cookiesContent[locale].intro };
}

export default async function CookiePolicyPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={cookiesContent[locale]} locale={locale} />;
}
