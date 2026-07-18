import { HelpCircle } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, EmptyState } from "@/lib/ui/primitives";

export const metadata = { title: "Ko'p so'raladigan savollar" };

async function getFaqs() {
  const supabase = createPublicServerClient();
  const { data } = await supabase.from("faqs").select("*").eq("is_active", true).is("deleted_at", null).order("position");
  return data ?? [];
}

export default async function FaqPage() {
  const faqs = await getFaqs();

  // JSON-LD structured data for rich search results (FAQPage schema).
  const jsonLd = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f: any) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-bg text-white">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <PublicHeader />
      <Container className="py-14 max-w-3xl">
        <h1 className="text-[28px] md:text-[36px] font-extrabold mb-8">Ko'p so'raladigan savollar</h1>

        {faqs.length === 0 ? (
          <EmptyState icon={<HelpCircle size={20} />} message="Hozircha savollar qo'shilmagan." />
        ) : (
          <div className="space-y-3">
            {faqs.map((f: any) => (
              <details key={f.id} className="group rounded-2xl border border-white/8 bg-white/[0.02] p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-[15px]">
                  {f.question}
                  <span className="text-muted group-open:rotate-45 transition-transform text-[20px] leading-none">+</span>
                </summary>
                <p className="text-[14px] text-muted leading-relaxed mt-3">{f.answer}</p>
              </details>
            ))}
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
