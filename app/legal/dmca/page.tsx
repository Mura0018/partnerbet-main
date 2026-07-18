import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { dmcaContent } from "@/lib/legal/dmca";
import { LegalPageLayout } from "@/lib/legal/LegalPageLayout";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return { title: dmcaContent[locale].title, description: dmcaContent[locale].intro };
}

export default async function DmcaPage() {
  const locale = await getServerLocale();
  return <LegalPageLayout content={dmcaContent[locale]} locale={locale} />;
}
