import { createAdminClient } from "@/lib/supabaseAdmin";
import type { SignatureVariant } from "@/lib/cashdesk/signatureVariants";

export type CashdeskSignatureSettings = {
  variant: SignatureVariant;
  dtOffsetHours: number;
  dryRun: boolean;
};

const DEFAULTS: CashdeskSignatureSettings = { variant: 1, dtOffsetHours: 0, dryRun: false };

// W3.3/W3.4/W3.5 — real Deposit/Payout/Balance chaqiruvlari (client.ts)
// shu sozlamalarni o'qiydi: qaysi imzo varianti, Balance'ning `dt`
// qaysi UTC siljishida yuborilishi, va quruq-rejim yoqiqmi.
export async function getCashdeskSignatureSettings(): Promise<CashdeskSignatureSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", "betcore_cashdesk_signature").maybeSingle();
    const v = (data?.value as any) ?? {};
    const variant = [1, 2, 3, 4].includes(Number(v.variant)) ? (Number(v.variant) as SignatureVariant) : DEFAULTS.variant;
    const dtOffsetHours = Number.isFinite(Number(v.dt_offset_hours)) ? Number(v.dt_offset_hours) : DEFAULTS.dtOffsetHours;
    const dryRun = v.dry_run === true;
    return { variant, dtOffsetHours, dryRun };
  } catch {
    return DEFAULTS;
  }
}
