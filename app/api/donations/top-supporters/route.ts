import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Public: returns only safe, intentionally-public fields (name, message,
// amount, date) for completed, public, non-anonymous donations. Never
// exposes donor_email or any internal donation/payment metadata.
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("donations")
    .select("donor_name, message, amount, currency, created_at")
    .eq("status", "completed")
    .eq("is_public", true)
    .eq("is_anonymous", false)
    .order("amount", { ascending: false })
    .limit(50);

  return NextResponse.json({ supporters: data ?? [] });
}
