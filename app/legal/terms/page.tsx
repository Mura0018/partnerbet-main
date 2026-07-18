import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { termsContent } from "@/lib/legal/terms";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: termsContent[locale].title, description: termsContent[locale].intro };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={termsContent[locale]} locale={locale} />;
}
