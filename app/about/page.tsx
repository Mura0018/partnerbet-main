import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { aboutContent } from "@/lib/legal/about";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: aboutContent[locale].title, description: aboutContent[locale].intro };
}

export default async function AboutPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={aboutContent[locale]} locale={locale} />;
}
