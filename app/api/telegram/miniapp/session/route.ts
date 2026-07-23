import { NextRequest, NextResponse } from "next/server";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const { initData } = await req.json().catch(() => ({ initData: null }));
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const verified = await resolveMiniApp(initData);
  if (!verified) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();

  if (!customer) return NextResponse.json({ registered: false });
  return NextResponse.json({ registered: true, customer });
}
