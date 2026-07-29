import { env } from "@/lib/env";

// =========================================================
// Provider-agnostik email yuboruvchi (Resend yoki Brevo — REST API orqali,
// SDK shart emas). MUHIM: SOZLANMAGAN yoki xato bo'lsa — log + `false`
// qaytaradi, HECH QACHON throw qilmaydi (fail-soft). Shu sabab chaqiruvchi
// oqim (parol tiklash / taklif) buzilmaydi. Maxfiy havolalar faqat email
// ichiga ketadi — hech qachon API javobiga emas.
// =========================================================

export type EmailInput = { to: string; subject: string; html: string; text?: string };

export async function sendEmail({ to, subject, html, text }: EmailInput): Promise<boolean> {
  const provider = env.emailProvider;
  const from = env.emailFrom;

  if (!from) {
    console.warn(
      "[email] EMAIL_FROM runtime'да BO'SH. Vercel > Settings > Environment Variables'да " +
      "EMAIL_FROM qo'yilganini (va PRODUCTION muhitiga belgilanganini) tekshiring, so'ng " +
      "yangi DEPLOY qiling (eski build'ni qayta ishga tushirish yetmasligi mumkin)."
    );
    return false;
  }

  try {
    if (provider === "brevo") {
      const key = env.brevoApiKey;
      if (!key) { console.warn("[email] BREVO_API_KEY yo'q"); return false; }
      const { name, email } = parseFrom(from);
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name, email },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text ?? stripHtml(html),
        }),
      });
      if (!res.ok) { console.warn("[email] Brevo xato:", res.status, await res.text().catch(() => "")); return false; }
      return true;
    }

    // default: Resend
    const key = env.resendApiKey;
    if (!key) { console.warn("[email] RESEND_API_KEY yo'q"); return false; }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text: text ?? stripHtml(html) }),
    });
    if (!res.ok) { console.warn("[email] Resend xato:", res.status, await res.text().catch(() => "")); return false; }
    return true;
  } catch (e) {
    console.warn("[email] yuborishда istisno:", e);
    return false;
  }
}

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*(.+?)\s*>\s*$/);
  if (m) return { name: m[1] || "BetCore Pay", email: m[2] };
  return { name: "BetCore Pay", email: from.trim() };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Brend qilingan "amal havolаси" email shabloni (taklif / parol tiklash uchun
// qayta ishlatiladi). Faqat matn + bitta tugma — sodda, ishonchli yetkaziladi.
export function renderActionEmail(opts: { heading: string; body: string; buttonLabel: string; url: string; note?: string }): string {
  const { heading, body, buttonLabel, url, note } = opts;
  return `<!doctype html><html><body style="margin:0;background:#0a1224;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:20px;font-weight:800;color:#1CE0C3;">BetCore Pay</span>
    </div>
    <div style="background:#111a2e;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px 24px;color:#e6ecf5;">
      <h1 style="font-size:18px;margin:0 0 12px;color:#ffffff;">${heading}</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 22px;color:#c3cede;">${body}</p>
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${url}" style="display:inline-block;background:#1CE0C3;color:#04231F;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;">${buttonLabel}</a>
      </div>
      <p style="font-size:11px;line-height:1.5;color:#7b89a0;margin:0;word-break:break-all;">Agar tugma ishlamasa, ushbu havolani brauzerга nusxalang:<br/>${url}</p>
      ${note ? `<p style="font-size:11px;color:#7b89a0;margin:14px 0 0;">${note}</p>` : ""}
    </div>
    <p style="text-align:center;font-size:10px;color:#5b6f85;margin:16px 0 0;">© BetCore Pay · couponbet.org</p>
  </div></body></html>`;
}
