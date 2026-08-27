// =====================================================================
//  FORMAT — TELEFON (F0 poydevor: sof funksiya)
//  O'zbek raqami: "+998 90 123 45 67". Kirish har xil bo'lishi mumkin
//  ("998901234567", "+998901234567", "901234567", "90 123 45 67").
//  Noma'lum shakl (12/9 xonali 998 emas) -> XOM qaytariladi (ko'rsatishni
//  buzmaslik uchun), bo'sh -> "—".
// =====================================================================
export function formatPhone(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "—";
  let digits = String(raw).replace(/\D/g, "");

  // 9 xonali lokal ("901234567") -> 998 prefiksini qo'shamiz.
  if (digits.length === 9) digits = "998" + digits;

  if (digits.length === 12 && digits.startsWith("998")) {
    const p = digits.slice(3); // 9 xonali milliy raqam
    return `+998 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 7)} ${p.slice(7, 9)}`;
  }

  // Tanib bo'lmadi -> xom (buzmaymiz).
  return String(raw);
}
