import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Same reasoning as payment-info/route.ts — no Request/cookies/headers
// usage means Next.js can otherwise freeze this response at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "branding").maybeSingle();
  const logoUrl = (data?.value as any)?.logo_media_id_url ?? null;
  return NextResponse.json({ logoUrl }, { headers: { "Cache-Control": "no-store" } });
}
