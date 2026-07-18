import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, Locale } from "@/lib/i18n/dictionaries";

// Server Component equivalent of useLocale() — reads the same cookie
// (set by LocaleSwitcher on the client) so legal/content pages render in
// whichever language the visitor already chose, without needing to be
// client components themselves (better for SEO).
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value === "uz" || value === "ru" || value === "en" ? value : DEFAULT_LOCALE;
}
