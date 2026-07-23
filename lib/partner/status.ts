import { createAdminClient } from "@/lib/supabaseAdmin";

// Hamkor 'active' (to'liq ishlaydigan) holatdami? Faqat active xizmat qiladi;
// suspended/pending bloklangan.
export async function isPartnerActive(partnerId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("partners").select("status").eq("id", partnerId).maybeSingle();
  return (data as any)?.status === "active";
}
