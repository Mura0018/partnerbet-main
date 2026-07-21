import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Same reasoning as payment-info/route.ts — no Request/cookies/headers
// usage means Next.js can otherwise freeze this response at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "branding").maybeSingle();
  const logoUrl = (data?.value as any)?.logo_media_id_url ?? null;
  const logoPosition = (data?.value as any)?.logo_media_id_position ?? { x: 50, y: 50 };
  return NextResponse.json({ logoUrl, logoPosition }, { headers: { "Cache-Control": "no-store" } });
}
