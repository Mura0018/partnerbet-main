import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { createPublicServerClient } from "@/lib/supabasePublic";
import { PublicHeader } from "@/lib/ui/PublicHeader";
import { PublicFooter } from "@/lib/ui/PublicFooter";
import { Container, Card, EmptyState } from "@/lib/ui/primitives";

export const metadata = { title: "Aloqa" };

async function getContactInfo() {
  const supabase = createPublicServerClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "contact_info").maybeSingle();
  return (data?.value as any) ?? {};
}

export default async function ContactPage() {
  const contact = await getContactInfo();
  const hasAnyContact = contact.email || contact.phone || contact.address;

  return (
    <div className="min-h-screen bg-bg text-white">
      <PublicHeader />
      <Container className="py-14 max-w-3xl">
        <h1 className="text-[32px] md:text-[42px] font-extrabold">Aloqa</h1>
        <p className="text-muted mt-3 text-[15px] mb-10">Savollaringiz bormi? Biz bilan bog'laning.</p>

        {!hasAnyContact ? (
          <EmptyState icon={<MessageCircle size={20} />} message="Aloqa ma'lumotlari hali sozlanmagan" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {contact.email && (
              <Card className="p-5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                  <Mail size={17} className="text-accent" />
                </div>
                <div className="text-[12px] text-muted mb-1">Email</div>
                <a href={`mailto:${contact.email}`} className="text-[15px] font-semibold hover:text-accent transition-colors">{contact.email}</a>
              </Card>
            )}
            {contact.phone && (
              <Card className="p-5">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                  <Phone size={17} className="text-accent" />
                </div>
                <div className="text-[12px] text-muted mb-1">Telefon</div>
                <a href={`tel:${contact.phone}`} className="text-[15px] font-semibold hover:text-accent transition-colors">{contact.phone}</a>
              </Card>
            )}
            {contact.address && (
              <Card className="p-5 sm:col-span-2">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                  <MapPin size={17} className="text-accent" />
                </div>
                <div className="text-[12px] text-muted mb-1">Manzil</div>
                <p className="text-[15px] font-semibold">{contact.address}</p>
              </Card>
            )}
          </div>
        )}
      </Container>
      <PublicFooter />
    </div>
  );
}
