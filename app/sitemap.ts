import type { MetadataRoute } from "next";
import { createPublicServerClient } from "@/lib/supabasePublic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://couponbet.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicServerClient();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/football`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/partners`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/apk`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/support/supporters`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/cookie-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/responsible-gaming`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/disclaimer`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/legal/dmca`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const [{ data: posts }, { data: news }, { data: partners }] = await Promise.all([
      supabase.from("posts").select("slug, updated_at").eq("status", "published").is("deleted_at", null).limit(1000),
      supabase.from("football_news").select("slug, updated_at").eq("status", "published").is("deleted_at", null).limit(1000),
      supabase.from("affiliate_partners").select("slug, updated_at").eq("is_active", true).is("deleted_at", null).limit(500),
    ]);

    dynamicRoutes = [
      ...(posts ?? []).map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
      ...(news ?? []).map((n) => ({ url: `${SITE_URL}/football/news/${n.slug}`, lastModified: n.updated_at, changeFrequency: "weekly" as const, priority: 0.6 })),
      ...(partners ?? []).map((p) => ({ url: `${SITE_URL}/partners/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.5 })),
    ];
  } catch {
    // If Supabase isn't reachable at build/request time, ship the static
    // routes only rather than failing the whole sitemap.
  }

  return [...staticRoutes, ...dynamicRoutes];
}
