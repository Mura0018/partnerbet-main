import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { responsibleGamingContent } from "@/lib/legal/responsibleGaming";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: responsibleGamingContent[locale].title, description: responsibleGamingContent[locale].intro };
}

export default async function ResponsibleGamingPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={responsibleGamingContent[locale]} locale={locale} />;
}
