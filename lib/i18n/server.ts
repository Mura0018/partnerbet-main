import { dictionaries, DEFAULT_LOCALE, LOCALE_COOKIE } from "./dictionaries";

// =========================================================
// Server tomonida lug'atdan matn olish (mijozga ketadigan avto-xabarlar,
// xodimlarga Telegram bildirishnomasi). Client t() bilan bir xil mantiq:
// topilmasa DEFAULT_LOCALE (uz), u ham topilmasa kalitning o'zi.
// =========================================================
export type ServerLocale = "uz" | "ru";

function resolveByPath(obj: unknown, path: string): string | undefined {
  const v = path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
  return typeof v === "string" ? v : undefined;
}

export function serverT(locale: ServerLocale, path: string, vars?: Record<string, string | number>): string {
  let str = resolveByPath(dictionaries[locale], path) ?? resolveByPath(dictionaries[DEFAULT_LOCALE], path) ?? path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v));
  }
  return str;
}

export function normalizeLocale(v: unknown): ServerLocale | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "ru" || s.startsWith("ru-") || s.startsWith("ru_")) return "ru";
  if (s === "uz" || s.startsWith("uz-") || s.startsWith("uz_")) return "uz";
  return null;
}

// Mijoz tili — mini app LocaleProvider bilan bir xil ustuvorlik:
//  1) partnerbet_locale cookie (mijoz tilni qo'lda tanlagan; mini app
//     o'z origin'iga fetch qiladi, cookie so'rov bilan keladi);
//  2) initData ichidagi user.language_code (ru* -> ru);
//  3) uz.
// initData chaqiruvchi tomonidan resolveMiniApp bilan ALLAQACHON tekshirilgan
// bo'lishi kerak — bu yerda faqat language_code o'qiladi.
export function customerLocale(cookieValue: string | undefined | null, initData: string | undefined | null): ServerLocale {
  const fromCookie = normalizeLocale(cookieValue);
  if (fromCookie) return fromCookie;
  try {
    const userRaw = initData ? new URLSearchParams(initData).get("user") : null;
    const lang = userRaw ? JSON.parse(userRaw)?.language_code : null;
    if (typeof lang === "string" && lang.toLowerCase().startsWith("ru")) return "ru";
  } catch {
    /* noto'g'ri initData — standart til */
  }
  return "uz";
}

export { LOCALE_COOKIE };
