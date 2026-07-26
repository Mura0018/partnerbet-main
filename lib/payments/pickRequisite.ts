import { createAdminClient } from "@/lib/supabaseAdmin";

// =========================================================
// W1.1/W1.6 — REKVIZIT TANLASH (poydevor).
// Ilgari mustaqil GET /payment-info bu tanlovni buyurtmadan TASHQARIDA
// qilardi (mijoz uni buyurtmasiz, cheksiz qayta so'rashi mumkin edi).
// Endi tanlov FAQAT buyurtma yaratilayotganda, shu yerda, BIR MARTA
// sodir bo'ladi — natija order qatoriga yoziladi va requisite_reveals'ga
// qayd etiladi (chaqiruvchi — /api/telegram/miniapp/orders — buni qiladi).
//
// Platforma mijozi (partnerId=null) VA hamkor mijozi (partnerId bор) —
// IKKALASI HAM shu bitta funksiyadan, bitta fair-rotation (usage_count
// eng kami + tenglikda tasodifiy) mantig'idan o'tadi (W1.6). Farqi:
// platforma kartalari operatorga tegishli va "band" (is_busy/is_online)
// holatiga qarab ustuvorlanadi — hamkor kartalari hamkorning o'ziga
// tegishli, xodim band/onlayn tushunchasi ularga tegishli emas.
// =========================================================

export type PickedRequisite = {
  accountNumber: string;
  holderName: string | null;
  operatorId: string | null; // platforma kartasi egasi (hamkor bo'lsa null)
  partnerId: string | null; // hamkor kartasi egasi (platforma bo'lsa null)
  methodRowId: string; // usage_count bump qilish uchun
  isPartner: boolean;
};

type Row = { id: string; number_or_account: string; holder: string | null; usage_count: number; owner_id: string };

// Fair pick: eng kam ishlatilgan (usage_count) qator ustuvor; tenglikda
// (platforma uchun — busyScore ham hisobga olinadi, pastda) tasodifiy.
function pickFairRow(rows: Row[], busyScore: Record<string, number> = {}): Row | null {
  if (rows.length === 0) return null;
  let best: Row[] = [];
  let bestKey = Infinity;
  for (const row of rows) {
    const busy = busyScore[row.owner_id] ?? 0;
    const key = busy * 1000 + row.usage_count;
    if (key < bestKey) {
      bestKey = key;
      best = [row];
    } else if (key === bestKey) {
      best.push(row);
    }
  }
  return best[Math.floor(Math.random() * best.length)];
}

export async function pickRequisiteForOrder(
  methodType: "card" | "click" | "payme" | "crypto",
  customerPartnerId: string | null
): Promise<PickedRequisite | null> {
  const admin = createAdminClient();

  if (customerPartnerId) {
    const { data } = await admin
      .from("partner_payment_methods")
      .select("id, number, holder, usage_count")
      .eq("partner_id", customerPartnerId)
      .eq("is_active", true)
      .eq("kind", methodType);
    const rows: Row[] = ((data as any[]) ?? []).map((r) => ({
      id: r.id,
      number_or_account: r.number,
      holder: r.holder ?? null,
      usage_count: r.usage_count ?? 0,
      owner_id: customerPartnerId,
    }));
    const picked = pickFairRow(rows);
    if (!picked) return null;
    return {
      accountNumber: picked.number_or_account,
      holderName: picked.holder,
      operatorId: null,
      partnerId: customerPartnerId,
      methodRowId: picked.id,
      isPartner: true,
    };
  }

  // Platforma mijozi — payment-info/route.ts'dan ko'chirilgan mantiq AYNAN.
  const [{ data: methodsData }, { data: pendingData }, { data: onlineData }] = await Promise.all([
    admin
      .from("telegram_operator_payment_methods")
      .select("id, operator_id, account_number, holder_name, usage_count")
      .eq("is_active", true)
      .eq("method_type", methodType),
    admin.from("telegram_orders").select("claimed_by").eq("status", "pending").not("claimed_by", "is", null),
    admin.from("profiles").select("id, is_online"),
  ]);

  const onlineIds = new Set((onlineData ?? []).filter((p: any) => p.is_online).map((p: any) => p.id));
  let rows = ((methodsData as any[]) ?? []).map((r) => ({
    id: r.id,
    number_or_account: r.account_number,
    holder: r.holder_name ?? null,
    usage_count: r.usage_count ?? 0,
    owner_id: r.operator_id,
  })) as Row[];
  if (rows.length === 0) return null;

  const hasOnlineCandidate = rows.some((r) => onlineIds.has(r.owner_id));
  if (hasOnlineCandidate) rows = rows.filter((r) => onlineIds.has(r.owner_id));

  const busyScore: Record<string, number> = {};
  for (const row of pendingData ?? []) {
    if ((row as any).claimed_by) busyScore[(row as any).claimed_by] = (busyScore[(row as any).claimed_by] ?? 0) + 1;
  }

  const picked = pickFairRow(rows, busyScore);
  if (!picked) return null;
  return {
    accountNumber: picked.number_or_account,
    holderName: picked.holder,
    operatorId: picked.owner_id,
    partnerId: null,
    methodRowId: picked.id,
    isPartner: false,
  };
}

// Tanlangan hamkor kartasining usage_count'ini oshiradi (fair-rotation,
// oddiy o'qi-yoz — mavjud bumpCardUsage/cardUsage.ts bilan bir xil uslub).
// Platforma kartasi bump'i chaqiruvchi tomonda bumpCardUsage(operatorId,
// accountNumber) orqali (mavjud, usage_limit/xabar bilan) — shu yerda
// takrorlanmaydi; hamkor kartasida limit/xabar tushunchasi yo'q.
export async function bumpPartnerRequisiteUsage(methodRowId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("partner_payment_methods").select("usage_count").eq("id", methodRowId).maybeSingle();
  await admin
    .from("partner_payment_methods")
    .update({ usage_count: ((data as any)?.usage_count ?? 0) + 1 })
    .eq("id", methodRowId);
}

export async function recordRequisiteReveal(params: {
  customerId: string;
  orderId: string;
  methodType: string;
  picked: PickedRequisite;
  ip: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("requisite_reveals").insert({
    customer_id: params.customerId,
    order_id: params.orderId,
    method_type: params.methodType,
    operator_id: params.picked.operatorId,
    partner_id: params.picked.partnerId,
    account_number: params.picked.accountNumber,
    holder_name: params.picked.holderName,
    ip: params.ip,
  });
}
