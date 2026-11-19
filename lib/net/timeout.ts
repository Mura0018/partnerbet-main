// =========================================================
// Tashqi so'rovlar uchun timeout — 5a dagi (app/api/cron/check-cashdesk-
// balances) va lib/affiliates/linkHealth.ts dagi AYNAN o'sha naqsh:
// AbortController + setTimeout(abort) + finally'da clearTimeout.
//
//   const to = startTimeout(5000);
//   try { const res = await fetch(url, { signal: to.signal }); ... }
//   finally { to.clear(); }
//
// MUHIM: pul harakatlantiruvchi chaqiruvlarda (cashdesk Deposit/Payout)
// ISHLATILMAYDI — mijoz tomonidagi abort masofaviy operatsiyani noaniq
// holatda qoldiradi; ular route darajasida race + 'pending' bilan himoyalangan.
// =========================================================
export function startTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
