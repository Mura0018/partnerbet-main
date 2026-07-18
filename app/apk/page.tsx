import { Download, ShieldCheck, Smartphone } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, Badge, EmptyState } from "@/lib/ui/primitives";
import { Button } from "@/lib/ui/Button";

export const metadata = { title: "Ilovani yuklab olish" };

async function getActiveRelease() {
  const supabase = createPublicServerClient();
  const { data } = await supabase
    .from("apk_releases")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export default async function ApkPage() {
  const release = await getActiveRelease();

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader active="/apk" />
      <Container className="py-14">
        <div className="text-center max-w-xl mx-auto mb-10">
          <Badge tone="gold" className="mx-auto mb-4"><Smartphone size={12} /> Rasmiy ilova</Badge>
          <h1 className="text-[32px] md:text-[42px] font-extrabold leading-tight">Ilovani yuklab oling</h1>
          <p className="text-muted mt-3 text-[15px]">Jonli natijalar, push bildirishnomalar va tahlillar — telefoningizda.</p>
        </div>

        {!release ? (
          <EmptyState icon={<Download size={20} />} message="Hozircha versiya mavjud emas" hint="Tez orada yuklab olish havolasi shu yerda paydo bo'ladi." />
        ) : (
          <Card className="max-w-lg mx-auto p-8 text-center animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-[0_0_30px_rgba(61,127,255,0.4)] mb-5">
              <Smartphone size={28} className="text-white" />
            </div>
            <h2 className="text-[20px] font-bold">Versiya {release.version}</h2>
            <p className="text-[12px] text-muted mt-1">Android {release.min_android}+ talab qilinadi</p>

            {release.changelog && (
              <div className="text-left mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="text-[11px] text-muted uppercase tracking-wide mb-2">Yangiliklar</div>
                <p className="text-[13px] text-white/90 whitespace-pre-line">{release.changelog}</p>
              </div>
            )}

            <Button href={release.download_url} variant="cta" size="lg" icon={<Download size={17} />} className="w-full mt-6">
              Download App {release.file_size_bytes ? `(${(release.file_size_bytes / (1024 * 1024)).toFixed(1)} MB)` : ""}
            </Button>

            <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-muted">
              <ShieldCheck size={13} /> Tekshirilgan, xavfsiz build{release.downloads_count ? ` · ${release.downloads_count} marta yuklab olingan` : ""}
            </div>
          </Card>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
