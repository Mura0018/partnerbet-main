import { isValidHttpUrl } from "@/lib/validation/url";

export type LinkStatus = "ok" | "broken" | "redirect_loop" | "invalid";

export type LinkHealthResult = {
  status: LinkStatus;
  httpStatus?: number;
  checkedAt: string;
};

const CHECK_FIELDS = ["website_url", "affiliate_url", "apk_url", "google_play_url", "app_store_url"] as const;
export type CheckableField = (typeof CHECK_FIELDS)[number];

const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 8000;

// Follows redirects manually (rather than letting fetch auto-follow) so we
// can positively detect a redirect LOOP — a distinct failure mode from a
// plain broken link — instead of just seeing a generic network error.
async function checkSingleUrl(url: string): Promise<LinkHealthResult> {
  const checkedAt = new Date().toISOString();

  if (!isValidHttpUrl(url)) {
    return { status: "invalid", checkedAt };
  }

  const seen = new Set<string>();
  let currentUrl = url;

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    if (seen.has(currentUrl)) {
      return { status: "redirect_loop", checkedAt };
    }
    seen.add(currentUrl);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "PartnerBet-LinkHealthCheck/1.0" },
      });
      clearTimeout(timeout);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { status: "broken", httpStatus: res.status, checkedAt };
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (res.status >= 200 && res.status < 300) {
        return { status: "ok", httpStatus: res.status, checkedAt };
      }

      return { status: "broken", httpStatus: res.status, checkedAt };
    } catch {
      return { status: "broken", checkedAt };
    }
  }

  return { status: "redirect_loop", checkedAt };
}

export async function checkPartnerLinks(
  partner: Record<CheckableField, string | null>
): Promise<Record<string, LinkHealthResult>> {
  const results: Record<string, LinkHealthResult> = {};
  for (const field of CHECK_FIELDS) {
    const value = partner[field];
    if (!value) continue; // optional field not set — nothing to check
    results[field] = await checkSingleUrl(value);
  }
  return results;
}
