import { resolveMiniApp } from "./resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Bosqich 7.3b: mini-app kontekstini (qaysi bot) aniqlab, mijozни topadi va
// KIRISH QOIDASINI qo'llaydi:
//  - Bizning app (partnerId=null): HAMMA mijoz (bizning + har hamkorning) kira oladi.
//  - Hamkor app (partnerId=X): FAQAT o'sha hamkor mijozi (customer.partner_id=X).
//    Begona (bizning yoki boshqa hamkor) mijoz => denied=true (jim rad etiladi).
export type CustomerRow = { id: string; telegram_id: number; partner_id: string | null; full_name: string | null; phone: string };
export type CustomerContext = {
  telegramId: number;
  partnerId: string | null;   // kontekst (qaysi bot orqali ochilgan)
  customer: CustomerRow | null;
  denied: boolean;            // mijoz bor, lekin boshqa "uy"ga tegishli
};

export async function resolveCustomerContext(initData: string): Promise<CustomerContext | null> {
  const ctx = await resolveMiniApp(initData);
  if (!ctx) return null;

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, telegram_id, partner_id, full_name, phone")
    .eq("telegram_id", ctx.telegramId)
    .maybeSingle();

  const denied = !!(ctx.partnerId && customer && (customer as any).partner_id !== ctx.partnerId);

  return {
    telegramId: ctx.telegramId,
    partnerId: ctx.partnerId,
    customer: (customer as CustomerRow) ?? null,
    denied,
  };
}
