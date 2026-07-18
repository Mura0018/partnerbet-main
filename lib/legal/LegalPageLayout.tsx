import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container } from "@/lib/ui/primitives";
import { LegalLocaleSwitcher } from "@/lib/legal/LegalLocaleSwitcher";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

export function LegalPageLayout({ content, locale }: { content: LegalPageContent; locale: Locale }) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-14 max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-[28px] md:text-[36px] font-extrabold">{content.title}</h1>
          <LegalLocaleSwitcher current={locale} />
        </div>
        {content.intro && <p className="text-[15px] text-white/85 leading-relaxed mb-8">{content.intro}</p>}
        <div className="space-y-7">
          {content.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-[16px] font-bold mb-2">{section.heading}</h2>
              <p className="text-[14px] text-muted leading-relaxed whitespace-pre-line">{section.body}</p>
            </div>
          ))}
        </div>
      </Container>
      <PublicFooter />
    </div>
  );
}
