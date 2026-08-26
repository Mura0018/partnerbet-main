// =====================================================================
//  FORMAT — ID VA KODLAR (F0 poydevor: sof funksiya)
//  account_id (1xBet ID) yorlig'i hamma joyda bir xil bo'lsin. Hozir
//  tarqoq: "ID: x", "ID x", "(ID: x)", "(x)". Standart -> "ID: 12345678".
//  Kodning MONO ko'rinishi (var(--mono)) — bu CSS/vizual masala, F4 da
//  className bilan qo'llanadi, bu yerda emas.
// =====================================================================

// "ID: 12345678" (prefiks ixtiyoriy). Bo'sh -> "—".
export function formatAccountId(
  id: string | number | null | undefined,
  opts: { prefix?: string } = {}
): string {
  const v = String(id ?? "").trim();
  if (!v) return "—";
  const prefix = opts.prefix ?? "ID";
  return `${prefix}: ${v}`;
}

// Qisqa buyurtma referensi (UUID -> "#8belgi"), jamoa chat/log uslubi.
// Bo'sh -> "—".
export function shortOrderRef(id: string | null | undefined): string {
  const v = String(id ?? "").trim();
  return v ? `#${v.slice(0, 8)}` : "—";
}
