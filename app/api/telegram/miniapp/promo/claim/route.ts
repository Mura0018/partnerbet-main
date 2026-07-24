import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { resolveCustomerContext } from "@/lib/telegram/resolveCustomer";

// B7 (A): mijoz sovrin kartasini BIR MARTA oladi. 3D ko'rinish B-bosqichда
// shu API'ga ulanadi. Aksiya o'chiq bo'lsa (promo.enabled=false) ruxsat yo'q.

// Holat: aksiya yoniqmi + mijoz kartani olganmi.
export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pRow } = await admin.from("site_settings").select("value").eq("key", "promo").maybeSingle();
  const enabled = !!(pRow?.value as any)?.enabled;
  const { data: card } = await admin.from("promo_cards").select("card_code, claimed_at").eq("customer_id", cc.customer.id).maybeSingle();

  return NextResponse.json({ enabled, card: card ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { initData } = body ?? {};
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const cc = await resolveCustomerContext(initData);
  if (!cc || cc.denied || !cc.customer) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pRow } = await admin.from("site_settings").select("value").eq("key", "promo").maybeSingle();
  if (!(pRow?.value as any)?.enabled) return NextResponse.json({ ok: false, error: "promo_disabled" });

  // Idempotent — allaqachon olgan bo'lsa o'shani qaytaramiz.
  const { data: existing } = await admin.from("promo_cards").select("card_code, claimed_at").eq("customer_id", cc.customer.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, card: existing, already: true });

  const code = crypto.randomBytes(5).toString("hex").toUpperCase();
  const { data: created, error } = await admin
    .from("promo_cards")
    .insert({ customer_id: cc.customer.id, card_code: code })
    .select("card_code, claimed_at")
    .maybeSingle();

  if (error) {
    // unique poyga (bir vaqtда 2 marta bosildi) -> qayta o'qiymiz
    const { data: again } = await admin.from("promo_cards").select("card_code, claimed_at").eq("customer_id", cc.customer.id).maybeSingle();
    if (again) return NextResponse.json({ ok: true, card: again, already: true });
    return NextResponse.json({ ok: false, error: "claim_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, card: created });
}
