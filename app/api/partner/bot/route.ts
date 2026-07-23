import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Hamkor o'z Telegram botini ulaydi. Faqat partner_admin.
// Token Telegram getMe orqali tekshiriladi va MAXFIY saqlanadi
// (partner_api_credentials, provider='telegram_bot'). Klient tokenni o'qiy olmaydi.
async function resolvePartnerAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: isAdmin } = await supabase.rpc("is_partner_admin");
  if (!isAdmin) return { ok: false as const, status: 403 };
  const { data: partnerId } = await supabase.rpc("current_partner_id");
  if (!partnerId) return { ok: false as const, status: 403 };
  return { ok: true as const, partnerId: partnerId as string };
}

export async function POST(req: NextRequest) {
  const check = await resolvePartnerAdmin();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const token = (body?.token ?? "").toString().trim();
  if (!token) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  // Tokenni Telegram orqali tekshirish
  let username = "";
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = await r.json();
    if (!j.ok) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    username = j.result?.username ?? "";
  } catch {
    return NextResponse.json({ error: "telegram_unreachable" }, { status: 502 });
  }

  const admin = createAdminClient();
  await admin.from("partner_api_credentials").delete().eq("partner_id", check.partnerId).eq("provider", "telegram_bot");
  const { error: insErr } = await admin.from("partner_api_credentials").insert({
    partner_id: check.partnerId,
    provider: "telegram_bot",
    credentials: { token, username },
    is_active: true,
  });
  if (insErr) return NextResponse.json({ error: "store_failed", detail: insErr.message }, { status: 500 });

  await admin.from("partners").update({ bot_username: username, bot_connected: true }).eq("id", check.partnerId);

  return NextResponse.json({ ok: true, username });
}

export async function DELETE() {
  const check = await resolvePartnerAdmin();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const admin = createAdminClient();
  await admin.from("partner_api_credentials").delete().eq("partner_id", check.partnerId).eq("provider", "telegram_bot");
  await admin.from("partners").update({ bot_username: null, bot_connected: false }).eq("id", check.partnerId);

  return NextResponse.json({ ok: true });
}
