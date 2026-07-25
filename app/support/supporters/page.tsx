import { Trophy } from "lucide-react";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, SectionHeading, EmptyState } from "@/lib/ui/primitives";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { dictionaries } from "@/lib/i18n/dictionaries";

export async function generateMetadata() {
  const d = dictionaries[await getServerLocale()];
  return { title: d.donations.topSupportersTitle };
}

async function getSupporters() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("donations")
    .select("donor_name, message, amount, currency, created_at")
    .eq("status", "completed")
    .eq("is_public", true)
    .eq("is_anonymous", false)
    .order("amount", { ascending: false })
    .limit(50);
  return data ?? [];
}

export default async function TopSupportersPage() {
  const supporters = await getSupporters();
  const d = dictionaries[await getServerLocale()];

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-14 max-w-2xl">
        <SectionHeading eyebrow="Rahmat" title={d.donations.topSupportersTitle} />
        {supporters.length === 0 ? (
          <EmptyState icon={<Trophy size={20} />} message="Hozircha homiylar yo'q." />
        ) : (
          <div className="space-y-3">
            {supporters.map((s: any, i: number) => (
              <Card key={i} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[14px]">{s.donor_name || "Anonim"}</div>
                  {s.message && <p className="text-[12px] text-muted mt-1">{s.message}</p>}
                </div>
                <div className="text-[15px] font-bold text-cta shrink-0 ml-3">${Number(s.amount).toFixed(0)}</div>
              </Card>
            ))}
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
