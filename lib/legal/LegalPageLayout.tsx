import { ScrollText } from "lucide-react";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container } from "@/lib/ui/primitives";
import { LegalLocaleSwitcher } from "@/lib/legal/LegalLocaleSwitcher";
import type { Locale } from "@/lib/i18n/dictionaries";
import type { LegalPageContent } from "@/lib/legal/about";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function LegalPageLayout({ content, locale }: { content: LegalPageContent; locale: Locale }) {
  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-14 max-w-5xl">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shrink-0">
              <ScrollText size={18} className="text-white" />
            </span>
            <h1 className="text-[26px] md:text-[34px] font-extrabold leading-tight">{content.title}</h1>
          </div>
          <LegalLocaleSwitcher current={locale} />
        </div>

        {content.intro && (
          <p className="text-[14px] text-white/75 leading-relaxed mb-10 max-w-2xl ml-[52px]">{content.intro}</p>
        )}

        <div className="grid md:grid-cols-[220px_1fr] gap-8">
          {/* On-this-page nav — desktop only, sticky */}
          <nav className="hidden md:block">
            <div className="sticky top-8">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Ushbu sahifada</div>
              <ol className="space-y-2.5">
                {content.sections.map((section, i) => (
                  <li key={section.heading}>
                    <a
                      href={`#${slugify(section.heading)}`}
                      className="flex gap-2 text-[13px] text-muted hover:text-accent transition-colors leading-snug"
                    >
                      <span className="text-[#3d4d5f] font-mono shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          {/* Document card */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 md:p-9">
            <div className="divide-y divide-white/5">
              {content.sections.map((section, i) => (
                <div key={section.heading} id={slugify(section.heading)} className="py-6 first:pt-0 last:pb-0 scroll-mt-8">
                  <div className="flex items-baseline gap-3 mb-2.5">
                    <span className="text-[12px] font-mono font-bold text-accent shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <h2 className="text-[16px] md:text-[17px] font-bold">{section.heading}</h2>
                  </div>
                  <p className="text-[14px] text-muted leading-relaxed whitespace-pre-line pl-[30px]">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
      <PublicFooter />
    </div>
  );
}
