import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { disclaimerContent } from "@/lib/legal/disclaimer";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: disclaimerContent[locale].title, description: disclaimerContent[locale].intro };
}

export default async function DisclaimerPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={disclaimerContent[locale]} locale={locale} />;
}
