import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkPartnerLinks } from "@/lib/affiliates/linkHealth";

// Shared by both the admin "Check Links" button and the scheduled cron
// job — keeps the actual checking logic in exactly one place.
export async function runLinkHealthCheck(partnerId?: string) {
  const supabase = createAdminClient();

  let query = supabase
    .from("affiliate_partners")
    .select("id, website_url, affiliate_url, apk_url, google_play_url, app_store_url")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (partnerId) query = query.eq("id", partnerId);

  const { data: partners } = await query;
  if (!partners) return { checked: 0 };

  for (const partner of partners) {
    const results = await checkPartnerLinks({
      website_url: partner.website_url,
      affiliate_url: partner.affiliate_url,
      apk_url: partner.apk_url,
      google_play_url: partner.google_play_url,
      app_store_url: partner.app_store_url,
    });
    await supabase
      .from("affiliate_partners")
      .update({ link_health: results, link_health_checked_at: new Date().toISOString() })
      .eq("id", partner.id);
  }

  return { checked: partners.length };
}
