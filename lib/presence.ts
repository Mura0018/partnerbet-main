// =========================================================
// Operator "haqiqiy onlayn" holati — YAGONA ta'rif (1-band, 0106).
//
//   onlayn = is_online (qo'lda tugma) VA last_seen_at oxirgi N daqiqa ichida
//
// last_seen_at'ni faqat server (/api/admin/shell, 30 s polling, service role)
// yozadi. N sozlanadi: NEXT_PUBLIC_PRESENCE_ONLINE_MINUTES (standart 4);
// SQL tomonidagi is_effectively_online(…, p_minutes default 4) bilan birga
// o'zgartiriladi.
//
//  - last_seen_at === null      -> OFFLINE (hech qachon ko'rilmagan).
//  - last_seen_at === undefined -> ustun hali yo'q (0106 qo'yilmagan, so'rov
//    ustunsiz qaytgan) — ESKI xulq: faqat is_online. Aks holda kod migratsiyadan
//    oldin chiqsa hamma offline bo'lib, cron barcha suhbatlarni bo'shatardi.
// =========================================================
export const PRESENCE_ONLINE_MINUTES = (() => {
  const v = Number(process.env.NEXT_PUBLIC_PRESENCE_ONLINE_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 4;
})();

export type PresenceRow = { is_online?: boolean | null; last_seen_at?: string | null };

export function isEffectivelyOnline(row: PresenceRow | null | undefined, nowMs: number = Date.now(), minutes: number = PRESENCE_ONLINE_MINUTES): boolean {
  if (!row || !row.is_online) return false;
  if (row.last_seen_at === undefined) return true; // 0106 yo'q -> eski xulq
  if (!row.last_seen_at) return false;
  const seen = Date.parse(row.last_seen_at);
  return Number.isFinite(seen) && nowMs - seen <= minutes * 60_000;
}

// Brauzer so'rovlari uchun: "shu vaqtdan keyin ko'rilgan" chegarasi (ISO).
export function presenceCutoffIso(nowMs: number = Date.now(), minutes: number = PRESENCE_ONLINE_MINUTES): string {
  return new Date(nowMs - minutes * 60_000).toISOString();
}

// Ustun bo'lsa u bilan, bo'lmasa (0106 yo'q) ustunsiz so'raydigan yordamchi:
// birinchi urinish xato bersa ikkinchisi chaqiriladi.
export async function withPresenceFallback<T>(
  withCol: () => PromiseLike<{ data: T | null; error: unknown }>,
  withoutCol: () => PromiseLike<{ data: T | null; error: unknown }>
): Promise<T | null> {
  const first = await withCol();
  if (!first.error) return first.data;
  const second = await withoutCol();
  return second.data;
}
