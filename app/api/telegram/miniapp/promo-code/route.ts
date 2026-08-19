import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Har so'rovda jonli bazadan o'qiladi (statik cache bo'lmasin — aks holda
// javob build vaqtida muzlaydi va admin o'zgarishlari ko'rinmaydi).
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mijoz app uchun MURAWIN promo kodi (ochiq kontent). Manba: site_settings
// 'promo_referral' kaliti (yagona manba). Xavfsizlik: agar aksiya o'chiq,
// muddat o'tgan yoki kod bo'sh bo'lsa — javobda kod MATNI umuman bo'lmaydi
// (frontend yashirishiga tayanmaymiz). Qator umuman bo'lmasa ham 500 emas.
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "promo_referral")
    .maybeSingle();

  const v = (data?.value as any) ?? null;

  const noStore = { headers: { "Cache-Control": "no-store" } };

  // O'chiq yoki qator yo'q -> bo'sh javob.
  if (!v || v.enabled !== true) return NextResponse.json({ promo: null }, noStore);

  // Muddat tekshiruvi (bor bo'lsa).
  if (v.expires_at) {
    const exp = new Date(v.expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) return NextResponse.json({ promo: null }, noStore);
  }

  const code = String(v.code ?? "").trim();
  if (!code) return NextResponse.json({ promo: null }, noStore);

  return NextResponse.json({
    promo: {
      code,
      description: String(v.description ?? "").trim() || null,
      link: String(v.link ?? "").trim() || null,
      expires_at: v.expires_at ?? null,
    },
  }, noStore);
}
