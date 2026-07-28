import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskCredsByIdAny } from "@/lib/cashdesk/store";
import { diagnoseCashdeskBalance } from "@/lib/cashdesk/client";
import type { SignatureVariant } from "@/lib/cashdesk/signatureVariants";
import { checkAndRecordRateLimit } from "@/lib/security/rateLimit";

// W3.2 — "Imzo diagnostikasi". FAQAT super_admin. FAQAT Balance metodini
// chaqiradi (diagnoseCashdeskBalance — Deposit/Payout bu faylda IMPORT
// QILINMAGAN, chaqirish strukturaviy jihatdan imkonsiz). Har chaqiruv
// cashdesk_diagnostic_log'ga qayd etiladi. hash/cashierpass HECH QACHON
// javobda yoki logda ochiq ko'rinmaydi — faqat oxirgi 4 belgi.
async function requireSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: profile } = await supabase.from("profiles").select("roles(key)").eq("id", user.id).maybeSingle();
  if ((profile as any)?.roles?.key !== "super_admin") return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireSuperAdmin();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  // Daqiqasiga 5 marta — super_admin ID'si bo'yicha (kassa/global emas,
  // shu kishining o'zi qancha sinaganini cheklaydi).
  const { allowed } = await checkAndRecordRateLimit(`cashdesk-diagnose:${check.userId}`, 60, 5);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const variantRaw = Number(body?.variant);
  const variant: SignatureVariant = [1, 2, 3, 4].includes(variantRaw) ? (variantRaw as SignatureVariant) : 1;
  const dtOffsetHours = Number.isFinite(Number(body?.dtOffsetHours)) ? Number(body.dtOffsetHours) : 0;

  const creds = await getCashdeskCredsByIdAny(id);
  if (!creds) return NextResponse.json({ error: "not_found_or_inactive" }, { status: 404 });

  const diagnosis = await diagnoseCashdeskBalance(creds, variant, dtOffsetHours);

  const admin = createAdminClient();
  try {
    await admin.from("cashdesk_diagnostic_log").insert({
      cashdesk_id: id,
      kind: "balance_test",
      signature_variant: variant,
      dt_offset_hours: dtOffsetHours,
      http_status: diagnosis.httpStatus,
      response: { rawResponse: diagnosis.rawResponse, aMasked: diagnosis.aMasked, bMasked: diagnosis.bMasked, networkError: diagnosis.networkError },
      masked_hash: diagnosis.maskedHash,
      masked_pass: diagnosis.maskedPass,
      requested_by: check.userId,
    });
  } catch {
    /* qayd best-effort — natijani ko'rsatishni bloklamaydi */
  }

  return NextResponse.json({
    variant,
    dtOffsetHours,
    httpStatus: diagnosis.httpStatus,
    networkError: diagnosis.networkError,
    rawResponse: diagnosis.rawResponse,
    aMasked: diagnosis.aMasked,
    bMasked: diagnosis.bMasked,
    dt: diagnosis.dt,
  });
}
