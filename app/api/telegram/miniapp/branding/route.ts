import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "branding").maybeSingle();
  const logoUrl = (data?.value as any)?.logo_media_id_url ?? null;
  return NextResponse.json({ logoUrl }, { headers: { "Cache-Control": "no-store" } });
}
