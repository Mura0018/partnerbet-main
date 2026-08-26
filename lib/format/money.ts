// =====================================================================
//  FORMAT — PUL (F0 poydevor: sof funksiya, hech qayerga ulanmagan)
//  Ajratgich: ru-RU (mingliklar bo'sh joy bilan: "50 000"). MUHIM — ru-RU
//  ajratgichi oddiy probel EMAS, uzilmas probel (U+00A0/U+202F); shuning
//  uchun tekshiruvda aniq matn emas, raqamlar solishtiriladi.
//  Valyuta BIRLIGI (so'm/сум) BU YERDA yo'q — u i18n'ga bog'liq. F1 da
//  chaqiruvchi `${formatMoney(n)} ${t(unit)}` ko'rinishida qo'shadi.
// =====================================================================
export function formatMoney(
  amount: number | null | undefined,
  opts: { decimals?: number } = {}
): string {
  const n = Number(amount);
  if (amount == null || !Number.isFinite(n)) return "—";
  const decimals = opts.decimals ?? 0; // so'm butun (kasrsiz)
  return n.toLocaleString("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
