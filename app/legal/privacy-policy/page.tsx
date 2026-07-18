import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { privacyContent } from "@/lib/legal/privacy";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: privacyContent[locale].title, description: privacyContent[locale].intro };
}

export default async function PrivacyPolicyPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={privacyContent[locale]} locale={locale} />;
}
