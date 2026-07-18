// Shared URL validation — used both client-side (Affiliate Manager forms,
// immediate feedback) and mirrored by CHECK constraints at the database
// level (see supabase/migrations/0025_affiliate_manager.sql) so invalid
// URLs can never be saved even if the client-side check is bypassed.

export function isValidHttpUrl(value: string): boolean {
  if (!value) return true; // empty is allowed for optional fields — required-ness is enforced separately
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDeepLink(value: string): boolean {
  if (!value) return true;
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
}

// Basic defensive trimming for free-text fields before they're sent to the
// database — React already escapes output at render time (no dangerouslySetInnerHTML
// is used for any of this content), so this is defense-in-depth against
// garbage/whitespace-padded input rather than an XSS boundary.
export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}
