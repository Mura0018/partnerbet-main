import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { sendEmail, renderActionEmail } from "@/lib/email/send";
import { env } from "@/lib/env";

// Umumiy parol tiklash (staff/mijoz) — client generateLink chaqirolmaydi
// (service-role kerak), shuning uchun bu server route. Recovery havolаsини
// server yaratib faqat EMAILга yuboradi (javobga emas — enumeration yo'q).
// Javob HAR DOIM neytral: email bor-yo'qligини oshkor qilmaydi.
// env.siteUrl — so'rov host'iga (req.url) EMAS, faqat env'ga tayanadi:
// aks holda buzilgan/qalbaki Host header havolani boshqa domenga yo'naltirib
// yuborishi mumkin edi (spoofing).
const REDIRECT = `${env.siteUrl}/auth/reset-password`;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`auth-request-reset:${ip}`, 3600, 8);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { email } = (await req.json().catch(() => ({}))) ?? {};
  if (!email || typeof email !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const { data } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim(),
      options: { redirectTo: REDIRECT },
    });
    const link = (data as any)?.properties?.action_link;
    if (link) {
      await sendEmail({
        to: email.trim(),
        subject: "BetCore Pay — parolni tiklash",
        html: renderActionEmail({
          heading: "Parolni tiklash",
          body: "Parolingizni tiklash uchun quyidagi tugmani bosing.",
          buttonLabel: "Parolni tiklash",
          url: link,
        }),
      });
    }
  } catch {
    // neytral — email bor-yo'qligini oshkor qilmaymiz
  }

  return NextResponse.json({ ok: true });
}
