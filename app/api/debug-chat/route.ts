import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("team_chat_messages")
    .select("id, message, created_at, sender_id, profiles(full_name, display_name, roles(key))")
    .order("created_at", { ascending: true })
    .limit(10);
  return NextResponse.json({
    qatorlar: data?.length ?? 0,
    xabarlar: data,
    xato: error?.message ?? null,
  });
}
