// =====================================================================
//  FORMAT — ODDIY TEKSHIRUV (F0). Test freymvorki YO'Q — node:assert.
//  Next build bu faylni IMPORT qilmaydi (o'lik kod), shuning uchun prod'ga
//  ta'sir qilmaydi; `tsc --noEmit` esa uni typecheck qiladi.
//  Qo'lda ishga tushirish (CommonJS'ga kompilyatsiya + node):
//    npx tsc lib/format/*.ts --outDir <tmp> --module commonjs \
//      --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
//    node <tmp>/checks.js
// =====================================================================
import * as assert from "node:assert/strict";
import { formatMoney } from "./money";
import { formatDate, formatTime, formatDateTime, formatDayLabel } from "./datetime";
import { formatPhone } from "./phone";
import { formatAccountId, shortOrderRef } from "./id";

// ru-RU ajratgichi uzilmas probel bo'lgani uchun aniq matn emas, raqamlarni
// solishtiramiz (bo'shliqlarni olib tashlab).
const digitsOnly = (s: string) => s.replace(/\s/g, "");
const TZ = "Asia/Tashkent";

export function runFormatChecks(): void {
  // ---- PUL ----
  assert.equal(digitsOnly(formatMoney(50000)), "50000");
  assert.equal(formatMoney(0), "0");
  assert.equal(formatMoney(null), "—");
  assert.equal(formatMoney(undefined), "—");
  assert.equal(formatMoney(NaN), "—");
  assert.equal(digitsOnly(formatMoney(1234567)), "1234567");
  assert.equal(formatMoney(1000, { decimals: 2 }).includes("00"), true); // "1 000,00"

  // ---- SANA/VAQT (Asia/Tashkent = UTC+5) ----
  // 2026-08-26T00:00Z = 05:00 Toshkent (o'sha kun)
  assert.equal(formatDate("2026-08-26T00:00:00Z", { timeZone: TZ }), "26.08.2026");
  assert.equal(formatTime("2026-08-26T00:00:00Z", { timeZone: TZ }), "05:00");
  assert.equal(formatDateTime("2026-08-26T00:00:00Z", { timeZone: TZ }), "26.08.2026 05:00");
  // TZ chegarasi: 2026-08-25T20:00Z = 01:00 Toshkent 26-avgust (UTC bo'lsa 25 bo'lardi)
  assert.equal(formatDate("2026-08-25T20:00:00Z", { timeZone: TZ }), "26.08.2026");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDateTime("axlat"), "—");
  // seconds opsiyasi (log/audit)
  assert.equal(formatTime("2026-08-26T00:00:05Z", { timeZone: TZ, seconds: true }), "05:00:05");
  assert.equal(formatDateTime("2026-08-26T00:00:05Z", { timeZone: TZ, seconds: true }), "26.08.2026 05:00:05");

  // ---- KUN YORLIG'I ----
  const now = "2026-08-26T10:00:00Z";
  assert.equal(formatDayLabel("2026-08-26T06:00:00Z", { timeZone: TZ, now, todayLabel: "T", yesterdayLabel: "Y" }), "T");
  assert.equal(formatDayLabel("2026-08-25T06:00:00Z", { timeZone: TZ, now, todayLabel: "T", yesterdayLabel: "Y" }), "Y");
  assert.equal(formatDayLabel("2026-08-20T06:00:00Z", { timeZone: TZ, now, todayLabel: "T", yesterdayLabel: "Y" }).includes("2026"), true);

  // ---- TELEFON ----
  assert.equal(formatPhone("998901234567"), "+998 90 123 45 67");
  assert.equal(formatPhone("+998901234567"), "+998 90 123 45 67");
  assert.equal(formatPhone("901234567"), "+998 90 123 45 67");
  assert.equal(formatPhone("90 123 45 67"), "+998 90 123 45 67");
  assert.equal(formatPhone(null), "—");
  assert.equal(formatPhone(""), "—");
  assert.equal(formatPhone("12345"), "12345"); // noma'lum -> xom

  // ---- ID / KOD ----
  assert.equal(formatAccountId("12345678"), "ID: 12345678");
  assert.equal(formatAccountId(12345678), "ID: 12345678");
  assert.equal(formatAccountId("  99 "), "ID: 99");
  assert.equal(formatAccountId(null), "—");
  assert.equal(formatAccountId("777", { prefix: "Hisob" }), "Hisob: 777");
  assert.equal(shortOrderRef("abcdef12-3456-7890"), "#abcdef12");
  assert.equal(shortOrderRef(null), "—");
}

// To'g'ridan-to'g'ri ishga tushirilganda (node checks.js) tekshiradi.
runFormatChecks();
// eslint-disable-next-line no-console
console.log("✓ format checks passed");
