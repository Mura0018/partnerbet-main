// =====================================================================
//  FORMAT — SANA/VAQT (F0 poydevor: sof, VAQT-ZONASI xabardor)
//  Brauzer mintaqasiga TAYANMAYDI — Intl + berilgan `timeZone`. timeZone
//  berilmasa DEFAULT_TIME_ZONE ishlatiladi.
//
//  Jonli site mintaqasi qayerda saqlanadi/o'qiladi:
//   - site_settings.timezone = {"tz": "Asia/Tashkent"} (0086_site_timezone.sql)
//   - lib/site/timezone.ts -> getTimezone() (async, SERVER-tomon; standart
//     "Asia/Tashkent") shu qatorni o'qiydi. Hozir faqat server-tomon
//     "bugun"/"shu oy" chegarasi uchun ishlatiladi, UI ko'rsatishда emas.
//   - F2 da chaqiruvchilar `timeZone: await getTimezone()` (server) yoki
//     client'ga uzatilgan qiymatni shu funksiyalarga beradi. Bu fayl SOF
//     bo'lib qolishi uchun (client'da ham ishlashi uchun) o'zi getTimezone()
//     ni CHAQIRMAYDI — faqat parametr qabul qiladi.
// =====================================================================

// DIQQAT: lib/site/timezone.ts dagi DEFAULT_TZ bilan BIR XIL bo'lishi SHART.
export const DEFAULT_TIME_ZONE = "Asia/Tashkent";

type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Berilgan lahza `tz`da qaysi kalendar kuniga to'g'ri kelishini "YYYY-MM-DD"
// sifatida qaytaradi (kun solishtirish uchun — formatDayLabel'da).
function tzDayKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// "26.08.2026"
export function formatDate(v: DateInput, opts: { timeZone?: string } = {}): string {
  const d = toDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: opts.timeZone ?? DEFAULT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// "14:30" (24 soatlik)
export function formatTime(v: DateInput, opts: { timeZone?: string } = {}): string {
  const d = toDate(v);
  if (!d) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: opts.timeZone ?? DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

// "26.08.2026 14:30"
export function formatDateTime(v: DateInput, opts: { timeZone?: string } = {}): string {
  const d = toDate(v);
  if (!d) return "—";
  return `${formatDate(d, opts)} ${formatTime(d, opts)}`;
}

// Telegram uslubi kun-yorlig'i: "Bugun" / "Kecha" / "26 avgust 2026".
// `now` (ixtiyoriy) — testda barqarorlik uchun; berilmasa joriy vaqt.
// today/yesterday yorliqlari i18n orqali chaqiruvchidan keladi (standartlar
// uzbekcha, faqat zaxira).
export function formatDayLabel(
  v: DateInput,
  opts: { timeZone?: string; now?: DateInput; todayLabel?: string; yesterdayLabel?: string } = {}
): string {
  const d = toDate(v);
  if (!d) return "—";
  const tz = opts.timeZone ?? DEFAULT_TIME_ZONE;
  const now = toDate(opts.now) ?? new Date();

  const key = tzDayKey(d, tz);
  if (key === tzDayKey(now, tz)) return opts.todayLabel ?? "Bugun";
  // Asia/Tashkent'da DST yo'q -> -24soat aniq "kecha" kunini beradi.
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === tzDayKey(yesterday, tz)) return opts.yesterdayLabel ?? "Kecha";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}
