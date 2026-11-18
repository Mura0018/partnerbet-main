import type { SupabaseClient } from "@supabase/supabase-js";

// =========================================================
// 6b — Kassa to'ldiruvchilar (cashdesk_fillers) yordamchilari. Faqat server.
//
// QOIDA: foydalanuvchining cashdesk_fillers'da birorta ham qatori bo'lmasa
// u BARCHA aktiv kassalar bo'yicha mas'ul (xabar ham, ko'rish ham).
// =========================================================

export const FILL_PERMISSION = "cashdesks.fill";

// 'cashdesks.fill' ruxsatiga ega rollar id'lari. Xato bo'lsa throw.
export async function fillRoleIds(admin: SupabaseClient): Promise<string[]> {
  const { data: perm, error: permErr } = await admin.from("permissions").select("id").eq("key", FILL_PERMISSION).maybeSingle();
  if (permErr) throw permErr;
  if (!perm) return [];
  const { data: rp, error: rpErr } = await admin.from("role_permissions").select("role_id").eq("permission_id", perm.id);
  if (rpErr) throw rpErr;
  return ((rp ?? []) as { role_id: string }[]).map((r) => r.role_id);
}

// Foydalanuvchiga biriktirilgan kassa id'lari. Bo'sh massiv = "biriktirilmagan
// -> barcha aktiv kassalar". Xato bo'lsa throw (chaqiruvchi xavfsiz tomonni tanlaydi).
export async function assignedCashdeskIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin.from("cashdesk_fillers").select("cashdesk_id").eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { cashdesk_id: string }[]).map((r) => r.cashdesk_id);
}
