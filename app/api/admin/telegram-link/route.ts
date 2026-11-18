import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Kriptografik tasodifiy manba (crypto.randomInt) — Math.random() prognoz
// qilinadi. Alifbo, uzunlik va oqim o'zgarmagan.
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  return code;
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  // 6c: operatorlar (telegram_orders.manage) YOKI kassa to'ldiruvchilar
  // (cashdesks.fill). Boshqa ruxsat qo'shilmaydi. Oqim o'zgarmagan:
  // bir martalik 6 belgili kod, 10 daqiqa, /link bilan bot orqali tasdiqlash.
  const { data: canOrders } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  let allowed = !!canOrders;
  if (!allowed) {
    const { data: canFill } = await supabase.rpc("has_permission", { perm_key: "cashdesks.fill" });
    allowed = !!canFill;
  }
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ telegram_link_code: code, telegram_link_code_expires_at: expiresAt })
    .eq("id", user.id);
  // Kod saqlanmasa — ishlamaydigan kodni ko'rsatmaymiz.
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  return NextResponse.json({ code });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("telegram_chat_id").eq("id", user.id).maybeSingle();
  return NextResponse.json({ linked: !!data?.telegram_chat_id });
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("profiles").update({ telegram_chat_id: null }).eq("id", user.id);
  return NextResponse.json({ success: true });
}
