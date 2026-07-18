import { NextRequest } from "next/server";

// Lightweight device/country/language detection for Smart Redirect and
// Click Analytics — no external dependency, just header/user-agent
// parsing. Good enough for redirect routing and analytics buckets;
// not a substitute for a full geo-IP database if higher precision is
// ever needed later.

export type Device = "desktop" | "mobile" | "tablet" | "unknown";

export function detectDevice(userAgent: string | null): Device {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook|silk/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/.test(ua)) return "mobile";
  if (/android/.test(ua)) return "tablet"; // generic "android" without "mobile" is usually a tablet
  return "desktop";
}

export function detectBrowser(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("chromium")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome")) return "Safari";
  return "Other";
}

// Vercel automatically populates x-vercel-ip-country on deployed requests.
// Falls back to a query override (?country=) for local testing, then "XX".
export function detectCountry(request: NextRequest): string {
  const override = request.nextUrl.searchParams.get("country");
  if (override) return override.toUpperCase();
  const header = request.headers.get("x-vercel-ip-country");
  if (header) return header.toUpperCase();
  return "XX";
}

// Prefers an explicit ?lang= override (matches the site's own locale
// cookie choices), then the browser's Accept-Language header, then "en".
export function detectLanguage(request: NextRequest): string {
  const override = request.nextUrl.searchParams.get("lang");
  if (override) return override.toLowerCase();
  const header = request.headers.get("accept-language");
  if (header) {
    const first = header.split(",")[0]?.split("-")[0]?.trim().toLowerCase();
    if (first) return first;
  }
  return "en";
}
