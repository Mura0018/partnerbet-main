import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { detectDevice, detectBrowser, detectCountry, detectLanguage } from "@/lib/geo";

// Smart Redirect + Click Analytics, unified in one route.
//
// Every affiliate link on the site (partner cards, banners, promo CTAs)
// should point here — /go/{partner-slug} — instead of directly at the
// partner's raw affiliate_url. This route:
//   1. Resolves the correct destination for THIS visitor (country/language/
//      device-aware, via partner_redirect_rules, falling back sensibly).
//   2. Logs the click (affiliate_clicks) for the analytics dashboard.
//   3. Increments fast denormalized counters.
//   4. 302-redirects the visitor.
//
// Uses the service-role client because this is trusted server-side
// business logic reading tables (partner_redirect_rules, affiliate_clicks)
// that are intentionally not exposed to the public via RLS.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: partner } = await supabase
    .from("affiliate_partners")
    .select("id, affiliate_url, deep_link, is_active, deleted_at, click_count")
    .eq("slug", slug)
    .maybeSingle();

  if (!partner || !partner.is_active || partner.deleted_at) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const device = detectDevice(request.headers.get("user-agent"));
  const browser = detectBrowser(request.headers.get("user-agent"));
  const country = detectCountry(request);
  const language = detectLanguage(request);
  const bannerId = request.nextUrl.searchParams.get("banner");

  // --- Resolve target URL: matching rule > device-aware deep link > default ---
  let targetUrl = partner.affiliate_url;

  const { data: rules } = await supabase
    .from("partner_redirect_rules")
    .select("match_type, match_value, target_url")
    .eq("partner_id", partner.id)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  const matchedRule = (rules ?? []).find((rule) => {
    if (rule.match_type === "country") return rule.match_value.toUpperCase() === country;
    if (rule.match_type === "language") return rule.match_value.toLowerCase() === language;
    if (rule.match_type === "device") return rule.match_value.toLowerCase() === device;
    return false;
  });

  if (matchedRule) {
    targetUrl = matchedRule.target_url;
  } else if ((device === "mobile" || device === "tablet") && partner.deep_link) {
    targetUrl = partner.deep_link;
  }

  // --- Log the click (best-effort — never block the redirect on this) ---
  try {
    await supabase.from("affiliate_clicks").insert({
      partner_id: partner.id,
      banner_id: bannerId,
      target_url: targetUrl,
      country,
      device,
      browser,
      language,
      referrer: request.headers.get("referer"),
    });
    await supabase
      .from("affiliate_partners")
      .update({ click_count: (partner.click_count ?? 0) + 1 })
      .eq("id", partner.id);
    if (bannerId) {
      const { data: banner } = await supabase.from("advertisements").select("clicks").eq("id", bannerId).maybeSingle();
      if (banner) {
        await supabase.from("advertisements").update({ clicks: (banner.clicks ?? 0) + 1 }).eq("id", bannerId);
      }
    }
  } catch {
    // Analytics is best-effort — a logging failure must never break the redirect.
  }

  return NextResponse.redirect(targetUrl, { status: 302 });
}
