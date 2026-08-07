// =========================================================
// W1.4 — ISM SOLISHTIRISH (yumshoq).
// customers.full_name (mijoz ro'yxatdan o'tganda kiritgan) bilan
// cashdesk/1xBet'dagi player_name'ni solishtiradi. ANIQ mos kelish
// TALAB QILINMAYDI — faqat quyidagilarga chidamli:
//   - registr (katta/kichik harf)
//   - ortiqcha bo'shliqlar
//   - so'z tartibi ("Toshev Murod" = "Murod Toshev")
//   - lotin/kirill transliteratsiyasi (o'zbek/rus kirillchasi)
// Xato yozilishi (typo)ga CHIDAMLI EMAS — bu ataylab (aniq so'ralmagan,
// haddan tashqari yumshoq solishtirish firibgarlikni ham "mos" deb
// hisoblab qo'yishi mumkin edi).
// =========================================================

// Kirill -> lotin (o'zbekcha standart translit, rus harflarini ham qamrab oladi).
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h", і: "i",
};

function transliterate(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out;
}

// Normalizatsiya: kichik harf + translit -> bo'shliq/tinish belgilarini
// yig'ish -> so'zlarga bo'lish -> alifbo tartibida saralash (so'z tartibi
// farqi yo'qolsin) -> qayta birlashtirish.
function normalize(input: string): string {
  const translit = transliterate(input.trim());
  const words = translit
    .replace(/['".,\-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return words.join(" ");
}

export type NameMatchResult = "matched" | "mismatched" | "no_reference";

// full_name yoki player_name bo'sh bo'lsa — solishtirib bo'lmaydi
// (chaqiruvchi buni alohida hal qiladi: full_name bo'sh -> mijozdan so'raladi).
export function matchCustomerName(fullName: string | null | undefined, playerName: string | null | undefined): NameMatchResult {
  if (!fullName || !fullName.trim() || !playerName || !playerName.trim()) return "no_reference";
  return normalize(fullName) === normalize(playerName) ? "matched" : "mismatched";
}
