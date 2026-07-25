import { createAdminClient } from "@/lib/supabaseAdmin";

const DEFAULT_TZ = "Asia/Tashkent";

// "Bugun"/"shu oy" chegarasini hisoblovchi server-tomon kodlar uchun yagona
// vaqt mintaqasi manbasi. site_settings.timezone dan o'qiydi (sozlanadi),
// standart "Asia/Tashkent". Xato/sozlanmagan bo'lsa standartga qaytadi —
// oqim buzilmaydi (getSlaMinutes bilan bir xil naqsh).
export async function getTimezone(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", "timezone").maybeSingle();
    const tz = (data?.value as any)?.tz;
    return typeof tz === "string" && tz ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

// Berilgan lahza (`at`) qaysi UTC daqiqasida ekanini `timeZone`dagi devor-soatga
// nisbatan hisoblaydi. Kutubxonasiz DST'ni to'liq hisobga oladigan yagona usul —
// Intl orqali devor-vaqtni o'qib, UTC bilan solishtirish.
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
    .formatToParts(at)
    .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return (asUtc - at.getTime()) / 60000;
}

// `at` lahzasi `timeZone`da qaysi kunga to'g'ri kelishini topib, o'sha kunning
// 00:00 (shu mintaqada) qiymatini UTC Date sifatida qaytaradi. Asia/Tashkent'da
// DST yo'q (doim UTC+5) — bu yerda aniq. DST'li mintaqa qo'shilsa, offset
// faqat `at` payti uchun hisoblangani sababli yil davomida 1-2 kunlik DST
// o'tish chegarasida ozgina (soatlik) noaniqlik bo'lishi mumkin.
export function startOfDayInTimezone(at: Date, timeZone: string): Date {
  const offsetMin = tzOffsetMinutes(at, timeZone);
  const shifted = new Date(at.getTime() + offsetMin * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMin * 60000);
}

// `at` lahzasi `timeZone`da qaysi oyga to'g'ri kelishini topib, o'sha oyning
// 1-kuni 00:00 (shu mintaqada) qiymatini UTC Date sifatida qaytaradi.
export function startOfMonthInTimezone(at: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" })
    .formatToParts(at)
    .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const guessUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, 1, 0, 0, 0);
  const offsetMin = tzOffsetMinutes(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offsetMin * 60000);
}
