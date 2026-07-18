import Link from "next/link";
import { Star, ExternalLink } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, Badge, SectionHeading, EmptyState } from "@/lib/ui/primitives";
import { Button } from "@/lib/ui/Button";

export const metadata = { title: "Hamkorlar" };

async function getPartners() {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("affiliate_partners")
    .select("id, slug, name, logo_url, bonus_description, rating, is_featured, promo_codes(id, code, is_active)")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("priority", { ascending: true });
  return data ?? [];
}

export default async function PartnersPage() {
  const partners = await getPartners();

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/partners" />
      <Container className="py-14">
        <SectionHeading eyebrow="Ishonchli hamkorlar" title="Barcha hamkorlar" />

        {partners.length === 0 ? (
          <EmptyState message="Hozircha hamkorlar mavjud emas." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {partners.map((p: any, i: number) => {
              const activeCodeCount = (p.promo_codes ?? []).filter((c: any) => c.is_active !== false).length;
              return (
                <Card key={p.id} className="p-6 stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
                  {p.is_featured && <Badge tone="gold" className="mb-3"><Star size={11} fill="currentColor" /> Featured</Badge>}
                  <div className="flex items-center gap-3 mb-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10" />
                    )}
                    <div>
                      <div className="font-bold text-[16px]">{p.name}</div>
                      {p.rating && <div className="text-[12px] text-vip">★ {p.rating} / 5</div>}
                    </div>
                  </div>
                  <p className="text-[13px] text-muted line-clamp-2 mb-4">{p.bonus_description}</p>
                  <div className="flex items-center gap-2">
                    <Button href={`/partners/${p.slug}`} variant="outline" size="sm" className="flex-1">Batafsil</Button>
                    <Button href={`/go/${p.slug}`} target="_blank" rel="noopener noreferrer sponsored" variant="cta" size="sm" icon={<ExternalLink size={13} />}>
                      Open Partner
                    </Button>
                  </div>
                  {activeCodeCount > 0 && <p className="text-[11px] text-muted mt-3">{activeCodeCount} ta faol promo-kod</p>}
                </Card>
              );
            })}
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
