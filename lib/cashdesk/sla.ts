import { createAdminClient } from "@/lib/supabaseAdmin";

// SLA daqiqasi (site_settings.cashdesk_sla = {"minutes": N}). Sozlanadi,
// standart 5. Xato / sozlanmagan bo'lsa 5 qaytaradi (oqim buzilmaydi).
export async function getSlaMinutes(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", "cashdesk_sla").maybeSingle();
    const m = Number((data?.value as any)?.minutes);
    return Number.isFinite(m) && m > 0 ? m : 5;
  } catch {
    return 5;
  }
}
