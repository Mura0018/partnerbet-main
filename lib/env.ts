/**
 * Environment o'zgaruvchilarini tekshirish.
 * Agar .env.local to'liq to'ldirilmagan bo'lsa, tushunarli xato beradi —
 * "Invalid URL" yoki "fetch failed" kabi noaniq runtime xatolar o'rniga.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[PartnerBet] "${name}" environment o'zgaruvchisi topilmadi. ` +
        `".env.local" faylini yarating (".env.example" dan nusxa oling) va ` +
        `barcha qiymatlarni to'ldiring. Vercel'da bu Settings > Environment Variables bo'limida.`
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  },
  get siteName() {
    return process.env.NEXT_PUBLIC_SITE_NAME || "PartnerBet";
  },
} as const;
