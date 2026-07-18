import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, ExternalLink, Globe, Smartphone, Copy, CheckCircle2 } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, Badge } from "@/lib/ui/primitives";
import { Button } from "@/lib/ui/Button";
import { PromoCodeButton } from "@/lib/ui/PromoCodeButton";
import { Breadcrumbs } from "@/lib/ui/Breadcrumbs";

async function getPartner(slug: string) {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("affiliate_partners")
    .select("*, promo_codes(id, code, bonus_description, is_active, is_featured, expires_at)")
    .eq("slug", slug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartner(slug);
  if (!partner) return { title: "Hamkor topilmadi" };
  return { title: partner.name, description: partner.description || partner.bonus_description || undefined };
}

export default async function PartnerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const partner = await getPartner(slug);
  if (!partner) notFound();

  const activeCodes = (partner.promo_codes ?? []).filter(
    (c: any) => c.is_active !== false && (!c.expires_at || new Date(c.expires_at) >= new Date())
  );

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/partners" />
      <Container className="py-14 max-w-3xl">
        <Breadcrumbs items={[{ label: "Partners", href: "/partners" }, { label: partner.name }]} />
        <div className="flex items-center gap-4 mb-6">
          {partner.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] font-extrabold">{partner.name}</h1>
              {partner.is_featured && <Badge tone="gold"><Star size={11} fill="currentColor" /> Featured</Badge>}
            </div>
            {partner.rating && <div className="text-[13px] text-vip mt-1">★ {partner.rating} / 5</div>}
          </div>
        </div>

        {partner.description && <p className="text-[15px] text-white/85 leading-relaxed mb-6">{partner.description}</p>}

        <Card className="p-6 mb-6">
          <div className="text-[13px] font-semibold mb-2">Bonus</div>
          <p className="text-[14px] text-muted leading-relaxed">{partner.bonus_description || "—"}</p>
          <Button href={`/go/${partner.slug}`} target="_blank" rel="noopener noreferrer sponsored" variant="cta" size="lg" icon={<ExternalLink size={16} />} className="w-full mt-5">
            Open Partner
          </Button>
        </Card>

        {activeCodes.length > 0 && (
          <div className="mb-6">
            <div className="text-[13px] font-semibold mb-3">Promo-kodlar</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {activeCodes.map((c: any) => (
                <PromoCodeButton key={c.id} id={c.id} code={c.code} description={c.bonus_description} />
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          {partner.website_url && (
            <Button href={partner.website_url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<Globe size={14} />}>Website</Button>
          )}
          {partner.google_play_url && (
            <Button href={partner.google_play_url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<Smartphone size={14} />}>Google Play</Button>
          )}
          {partner.apk_url && (
            <Button href={partner.apk_url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<Smartphone size={14} />}>APK</Button>
          )}
        </div>

        <p className="text-[11px] text-[#5b6f85] mt-8 leading-relaxed">
          18+ only. Gambling can be addictive — please play responsibly. This is a sponsored
          affiliate link; {partner.name} is a third-party licensed operator.
        </p>
      </Container>
      <PublicFooter />
    </div>
  );
}
