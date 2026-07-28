import crypto from "crypto";

// =========================================================
// W3.4 — IMZO VARIANTLARI (zaxira). Retsept aniq emasligi sababli 4 ta
// ehtimoliy variant — 1-variant JORIY (o'zgarmas, hozirgi production
// formulasi), qolgan 3 tasi ZAXIRA (faqat dt-variantlari yordam
// bermasa sinaladi). Har biri BITTA o'zgaruvchi bo'yicha farq qiladi:
//   1 — joriy (kichik harf kalitlar, hujjatdagi tartib, "&" ajratuvchi)
//   2 — REGISTR: kalit nomlarining birinchi harfi katta (Hash=, Dt=...)
//   3 — TARTIB: A/B ichidagi maydonlar teskari tartibda
//   4 — AJRATUVCHI: "&" o'rniga ";"
// Faqat `sign` hisoblanishiga ta'sir qiladi — `confirm` (md5(id:hash))
// hech qachon o'zgarmaydi (bu allaqachon hujjat misollariga mos
// tekshirilgan, 3/3).
// =========================================================

export type SignatureVariant = 1 | 2 | 3 | 4;
export const SIGNATURE_VARIANTS: SignatureVariant[] = [1, 2, 3, 4];

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function md5(input: string): string {
  return crypto.createHash("md5").update(input).digest("hex");
}

type FieldPair = [key: string, value: string];

// Bitta variant bo'yicha maydonlar ro'yxatini (tartibi, kalit registri,
// ajratuvchisi variantga qarab o'zgargan holda) bitta qatorga yig'adi.
function assemble(pairs: FieldPair[], variant: SignatureVariant): string {
  const ordered = variant === 3 ? [...pairs].reverse() : pairs;
  const sep = variant === 4 ? ";" : "&";
  return ordered
    .map(([key, value]) => {
      const k = variant === 2 ? key.charAt(0).toUpperCase() + key.slice(1) : key;
      return `${k}=${value}`;
    })
    .join(sep);
}

export function computeSign(aPairs: FieldPair[], bPairs: FieldPair[], variant: SignatureVariant): string {
  const a = sha256(assemble(aPairs, variant));
  const b = md5(assemble(bPairs, variant));
  return sha256(a + b);
}

// Diagnostika/hisobot uchun — imzo qurishda ishlatilgan xom (variantga
// mos) A/B qatorlarini qaytaradi (chaqiruvchi bularni ko'rsatishdan
// oldin hash/cashierpass qiymatlarini niqoblashi SHART).
export function debugAB(aPairs: FieldPair[], bPairs: FieldPair[], variant: SignatureVariant): { a: string; b: string } {
  return { a: assemble(aPairs, variant), b: assemble(bPairs, variant) };
}
