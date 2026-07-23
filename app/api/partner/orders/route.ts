import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Hamkor a'zolari uchun O'Z buyurtmalari (partner_id bo'yicha).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: partnerId } = await supabase.rpc("current_partner_id");
  if (!partnerId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("telegram_orders")
    .select("id, type, platform, account_id, amount, payment_method, status, player_name, operator_note, created_at, customers(phone, full_name)")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ orders: orders ?? [] });
}
