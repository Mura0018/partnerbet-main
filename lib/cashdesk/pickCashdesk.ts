import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskCredsById, listCashdesks } from "@/lib/cashdesk/store";
import { getCashdeskBalance } from "@/lib/cashdesk/client";

// =========================================================
// 3-BOSQICH: kassa tanlash (balans tenglashtirish).
//  - Egasi bор mijoz -> owner operator kassasi (egalik buzilmaydi).
//  - Yangi (egasiz) mijoz -> balansi eng KAM aktiv kassa.
//  - Balans olinmasa (kalit yo'q / API xato / sekin) -> fallback: eng kam
//    pending buyurtmali aktiv kassa. HECH QACHON buyurtma yaratishni
//    bloklamaydi/kutmaydi (timeout + fallback).
// =========================================================

const BALANCE_TIMEOUT_MS = 2500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Owner operatorga biriktirilgan aktiv kassa (bo'lmasa null).
export async function pickCashdeskForOwner(ownerOperatorId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cashdesks")
    .select("id")
    .eq("owner_operator_id", ownerOperatorId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

// Fallback: eng kam pending buyurtmali aktiv kassa (balans API ishlamasa).
async function pickLeastLoaded(ids: string[]): Promise<string> {
  const admin = createAdminClient();
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = 0;
  try {
    const { data } = await admin.from("telegram_orders").select("cashdesk_id").eq("status", "pending").in("cashdesk_id", ids);
    for (const row of (data ?? []) as any[]) {
      if (row.cashdesk_id && counts[row.cashdesk_id] != null) counts[row.cashdesk_id]++;
    }
  } catch {
    /* cashdesk_id ustuni hali yo'q -> hammasi 0, birinchisi tanlanadi */
  }
  let best = ids[0];
  for (const id of ids) if (counts[id] < counts[best]) best = id;
  return best;
}

// Yangi (egasiz) mijoz uchun: balansi eng kam aktiv kassa (fallback bilan).
export async function pickCashdeskBalanced(): Promise<string | null> {
  const active = (await listCashdesks()).filter((c) => c.is_active);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0].id;

  // Balanslarni parallel + timeout bilan ol (Cashdesk API metod 1).
  const balances = await Promise.all(
    active.map(async (c) => {
      try {
        const creds = await getCashdeskCredsById(c.id);
        if (!creds) return { id: c.id, balance: null as number | null };
        const res = await withTimeout(getCashdeskBalance(creds), BALANCE_TIMEOUT_MS);
        if (res && res.ok && res.data.Balance != null) return { id: c.id, balance: Number(res.data.Balance) };
        return { id: c.id, balance: null as number | null };
      } catch {
        return { id: c.id, balance: null as number | null };
      }
    })
  );

  const withBalance = balances.filter((b) => b.balance != null) as { id: string; balance: number }[];
  if (withBalance.length > 0) {
    withBalance.sort((a, b) => a.balance - b.balance);
    return withBalance[0].id; // eng kam balans
  }

  // Balans hech qaysidan olinmadi -> yuk bo'yicha fallback.
  return pickLeastLoaded(active.map((c) => c.id));
}

// Yakuniy: egasiga qarab kassa tanlash. Xato bo'lsa null (chaqiruvchi
// default kassaga tushadi). Buyurtma yaratishni HECH QACHON bloklamaydi.
export async function resolveOrderCashdesk(ownerOperatorId: string | null): Promise<string | null> {
  try {
    if (ownerOperatorId) {
      const owned = await pickCashdeskForOwner(ownerOperatorId);
      if (owned) return owned; // egalik -> o'z operatori kassasi
      // owner operatorda kassa yo'q -> fallback (kam balansli / kam yuklangan)
    }
    return await pickCashdeskBalanced();
  } catch {
    return null;
  }
}
