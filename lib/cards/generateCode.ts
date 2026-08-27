import crypto from "crypto";

// =====================================================================
//  QR KARTA KODI — generatsiya + normalizatsiya (1a)
//  Format: "CP" prefiksi + 10 tasodifiy belgi (kriptografik). Prefiks —
//  brend (BetCore / Core Pay) va begona QR ni ajratish uchun; karta
//  dizaynidagi "CP-..." ko'rinishiga mos.
//  Bazada AJRATGICHSIZ saqlanadi (masalan "CPK7P29QX4M3").
//  MUHIM: eski kartalar PREFIKSIZ — skaner ikkalasini ham qabul qiladi
//  (normalizeCardCode faqat tozalaydi, prefiksni talab qilmaydi).
// =====================================================================

// Adashtirmaydigan alifbo (Crockford-32 uslubi): I, L, O, U OLIB TASHLANGAN
// (0/O, 1/I chalkashligi yo'q — qo'lda tersa xato bo'lmaydi). 32 belgi ->
// 256 % 32 = 0, ya'ni modulo bias YO'Q (bir tekis taqsimot).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PREFIX = "CP";
const BODY_LEN = 10;

// Bitta karta kodi: CP + 10 tasodifiy belgi. Taxmin qilib bo'lmaydi
// (ketma-ket EMAS — har belgi kriptografik tasodifiy).
export function generateCardCode(): string {
  const bytes = crypto.randomBytes(BODY_LEN);
  let body = "";
  for (let i = 0; i < BODY_LEN; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  return PREFIX + body;
}

// Skaner/kiritish normalizatsiyasi: bo'shliq va chiziqchalarni TASHLAYDI,
// katta harfga o'tkazadi. Chop etilgan "CP-8F3K-2M9Q..." -> "CP8F3K2M9Q...".
// Eski (prefiksiz) kodlar ham xuddi shunday normallashtiriladi.
// (500 ta karta chop etilgach mos kelmaslik chiqmasin — grouping ajratgichi
// bazaga tegmaydi.)
export function normalizeCardCode(raw: string): string {
  return String(raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
}

// Ko'rsatish uchun guruhlash (CP + 10 -> "CP-XXXX-XXXX-XX"). FAQAT vizual;
// QR va baza xom kodni ishlatadi. Eski (prefiksiz) kod guruhlanmaydi.
export function groupCardCode(code: string): string {
  const c = normalizeCardCode(code);
  if (!c.startsWith(PREFIX)) return c;
  const body = c.slice(PREFIX.length);
  const parts = body.match(/.{1,4}/g) ?? [body];
  return PREFIX + "-" + parts.join("-");
}
