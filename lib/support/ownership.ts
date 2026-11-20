import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================
// Support suhbati egaligi (3-band).
//
// ATOMIK egalik olish — W2 dagi shartli UPDATE naqshi: `claimed_by is null`
// bo'lsagina yoziladi va faqat qator QAYTARGAN chaqiruv egalikni olgan
// hisoblanadi. Ikki operator bir vaqtda olsa — bittasi yutadi.
//
// Rahbar ruxsati: telegram_operators.manage (admin, super_admin) — egasi
// boshqa bo'lsa ham javob bera oladi (egalikni o'zgartirmaydi).
// =========================================================
export const SUPPORT_OVERRIDE_PERMISSION = "telegram_operators.manage";

export async function claimThreadIfUnclaimed(admin: SupabaseClient, customerId: string, userId: string): Promise<boolean> {
  // Thread qatori yo'q bo'lsa yaratiladi (egasiz) — mavjudiga tegmaydi.
  await admin
    .from("telegram_support_threads")
    .upsert({ customer_id: customerId }, { onConflict: "customer_id", ignoreDuplicates: true });
  const { data, error } = await admin
    .from("telegram_support_threads")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("claimed_by", null)
    .select("customer_id");
  return !error && (data?.length ?? 0) > 0;
}

export type ReplyOwnership =
  | { ok: true; claimedNow: boolean }
  | { ok: false; ownerId: string; ownerName: string | null };

// Javob berishdan OLDIN: egasi shu operator bo'lsa — ruxsat; egasiz bo'lsa —
// egalik atomik olinadi (javob bilan birga); boshqa operatorniki bo'lsa —
// faqat rahbar (canOverride) javob bera oladi, aks holda rad etiladi.
export async function ensureReplyOwnership(
  admin: SupabaseClient,
  customerId: string,
  userId: string,
  canOverride: boolean
): Promise<ReplyOwnership> {
  if (await claimThreadIfUnclaimed(admin, customerId, userId)) return { ok: true, claimedNow: true };

  const { data: thr } = await admin
    .from("telegram_support_threads")
    .select("claimed_by")
    .eq("customer_id", customerId)
    .maybeSingle();
  const ownerId = (thr as { claimed_by: string | null } | null)?.claimed_by ?? null;
  if (!ownerId || ownerId === userId || canOverride) return { ok: true, claimedNow: false };

  const { data: owner } = await admin.from("profiles").select("display_name, full_name").eq("id", ownerId).maybeSingle();
  const o = owner as { display_name: string | null; full_name: string | null } | null;
  return { ok: false, ownerId, ownerName: o?.display_name || o?.full_name || null };
}

// 3-band: yakunlash / arxivlash / xabarni o'chirish — javob bilan bir xil
// qoida, lekin egalik OLINMAYDI: egasi shu operator, egasiz suhbat yoki
// rahbar (canOverride) bo'lsa ruxsat; aks holda egasi ma'lumoti bilan rad.
export async function checkThreadOwnership(
  admin: SupabaseClient,
  customerId: string,
  userId: string,
  canOverride: boolean
): Promise<ReplyOwnership> {
  if (canOverride) return { ok: true, claimedNow: false };
  const { data: thr } = await admin
    .from("telegram_support_threads")
    .select("claimed_by")
    .eq("customer_id", customerId)
    .maybeSingle();
  const ownerId = (thr as { claimed_by: string | null } | null)?.claimed_by ?? null;
  if (!ownerId || ownerId === userId) return { ok: true, claimedNow: false };
  const { data: owner } = await admin.from("profiles").select("display_name, full_name").eq("id", ownerId).maybeSingle();
  const o = owner as { display_name: string | null; full_name: string | null } | null;
  return { ok: false, ownerId, ownerName: o?.display_name || o?.full_name || null };
}
