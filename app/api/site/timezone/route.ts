import { NextResponse } from "next/server";
import { getTimezone } from "@/lib/site/timezone";

// Site vaqt mintaqasi (site_settings.timezone) — client (admin layout)
// SiteTimezoneProvider shu yerdan oladi. TZ maxfiy emas (ommaviy o'qish).
// force-dynamic + no-store: statik cache'ga tushmasin (promo-code bug saboqi).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const tz = await getTimezone();
  return NextResponse.json({ tz }, { headers: { "Cache-Control": "no-store" } });
}
