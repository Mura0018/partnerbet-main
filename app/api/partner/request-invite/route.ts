import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { sendEmail, renderActionEmail } from "@/lib/email/send";

// App'dagi "Hamkormisiz?" — hamkor o'z emaili orqali parol havolasini oladi.
// XAVFSIZLIK: havola HECH QACHON javobda qaytarilmaydi. Faqat hamkor bo'lsa,
// Supabase parol-tiklash havolasini EGASINING emailiga yuboradi. Javob har doim
// bir xil neytral (email enumeratsiyasi/akkaunt egallash oldini oladi).
const NEUTRAL = { ok: true, message: "Agar bu email hamkor bo'lsa, parol havolasi emailingizga yuborildi." };
const RESET_REDIRECT = "https://www.couponbet.org/partner/set-password";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`partner-request-invite:${ip}`, 3600, 8);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { email } = (await req.json().catch(() => ({}))) ?? {};
  if (!email || typeof email !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profileId } = await admin.rpc("partner_profile_by_email", { p_email: email.trim() });

  // Faqat haqiqiy hamkor a'zosiga email yuboriladi; javob har doim bir xil.
  if (profileId) {
    try {
      // Tashqi email provider orqali: recovery havolаsини server yaratadi
      // (generateLink) va faqat EMAIL ichiga yuboradi — javobga emas.
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: email.trim(),
        options: { redirectTo: RESET_REDIRECT },
      });
      const actionLink = (linkData as any)?.properties?.action_link;
      if (actionLink) {
        await sendEmail({
          to: email.trim(),
          subject: "BetCore Pay — parolni tiklash",
          html: renderActionEmail({
            heading: "Parolni tiklash",
            body: "Hamkor paneliga kirish parolingizni tiklash uchun quyidagi tugmani bosing.",
            buttonLabel: "Parolni tiklash",
            url: actionLink,
          }),
        });
      }
    } catch {
      // neytral javob — xatoni oshkor qilmaymiz
    }
  }

  return NextResponse.json(NEUTRAL);
}
