"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type SiteSettingsMap = Record<string, any>;

// Module-level cache: PublicHeader and PublicFooter (rendered together on
// nearly every public page) both need site_settings — without this they'd
// each fire their own independent network request on every page load.
// This shares a single in-flight/resolved fetch per page load instead.
let cachedPromise: Promise<SiteSettingsMap> | null = null;

function fetchSiteSettings(): Promise<SiteSettingsMap> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("site_settings")
          .select("key, value")
          .in("key", ["site_identity", "branding", "footer", "contact_info", "social_links"]);
        return Object.fromEntries((data ?? []).map((r) => [r.key, r.value as any]));
      } catch {
        return {};
      }
    })();
  }
  return cachedPromise;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettingsMap>({});

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings().then((data) => {
      if (!cancelled) setSettings(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
