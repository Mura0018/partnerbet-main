import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("telegram_operator_payment_methods")
    .select("account_number, holder_name, is_active");
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    qatorlar_soni: data?.length ?? 0,
    kartalar: data,
    xato: error?.message ?? null,
  });
}
