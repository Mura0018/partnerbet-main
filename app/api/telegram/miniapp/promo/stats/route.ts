import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";

export const dynamic = "force-dynamic";

// Mijozning O'Z faoliyat statistikasi (hero karta uchun): aylanma + reytingdagi
// o'rni + karta oxirgi 4 raqami. FAQAT O'QISH. Boshqa mijozlar ma'lumoti
// qaytarilmaydi — mavjud promo_activity_ranking_v2 (security definer) dan
// faqat shu mijozning qatori ajratib olinadi.
export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const customerId = cc.customer.id;

  // To'liq reyting (barcha davr). Faqat mijozning qatori + o'rni olinadi.
  let volume = 0;
  let rank: number | null = null;
  let totalRanked = 0;
  try {
    const { data } = await admin.rpc("promo_activity_ranking_v2", { p_start: null, p_end: null });
    const rows: any[] = Array.isArray(data) ? data : [];
    totalRanked = rows.length;
    const idx = rows.findIndex((r) => r.id === customerId);
    if (idx >= 0) {
      rank = idx + 1;
      volume = Number(rows[idx].volume ?? 0);
    }
  } catch {
    /* ranking mavjud emas -> 0/null */
  }

  // Karta oxirgi 4 raqami
  let cardLast4: string | null = null;
  let hasCard = false;
  try {
    const { data: card } = await admin.from("promo_cards").select("card_code").eq("customer_id", customerId).maybeSingle();
    if ((card as any)?.card_code) {
      hasCard = true;
      const code = String((card as any).card_code);
      cardLast4 = code.slice(-4);
    }
  } catch {
    /* skip */
  }

  return NextResponse.json(
    {
      fullName: cc.customer.full_name ?? null,
      cardLast4,
      hasCard,
      volume,
      rank,
      totalRanked,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
