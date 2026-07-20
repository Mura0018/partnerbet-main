import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  await admin.from("profiles").update({ telegram_link_code: code, telegram_link_code_expires_at: expiresAt }).eq("id", user.id);

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
