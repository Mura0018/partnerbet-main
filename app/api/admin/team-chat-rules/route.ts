import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// 8-BOSQICH: jamoa chati pinned qoidalari (site_settings.team_chat_rules).
// Hamma xodim o'qiydi; faqat super_admin (operators.oversight) tahrirlaydi.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from("site_settings").select("value").eq("key", "team_chat_rules").maybeSingle();
  return NextResponse.json({ text: (data?.value as any)?.text ?? "" });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "operators.oversight" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").slice(0, 2000);

  const admin = createAdminClient();
  await admin.from("site_settings").upsert(
    { key: "team_chat_rules", value: { text }, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  return NextResponse.json({ ok: true, text });
}
