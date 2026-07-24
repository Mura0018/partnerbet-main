import { createAdminClient } from "@/lib/supabaseAdmin";

// 7-BOSQICH: alert + reyting yordamchilari. Hammasi best-effort — asosiy
// oqimni (buyurtma bajarish/handoff) HECH QACHON buzmaydi.

type Admin = ReturnType<typeof createAdminClient>;

export type AlertSettings = { level2: number; level3: number; windowHours: number };

export async function getAlertSettings(): Promise<AlertSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", "cashdesk_alert").maybeSingle();
    const v = (data?.value as any) ?? {};
    const l2 = Number(v.level2);
    const l3 = Number(v.level3);
    const wh = Number(v.window_hours);
    return {
      level2: Number.isFinite(l2) && l2 > 0 ? l2 : 3,
      level3: Number.isFinite(l3) && l3 > 0 ? l3 : 5,
      windowHours: Number.isFinite(wh) && wh > 0 ? wh : 24,
    };
  } catch {
    return { level2: 3, level3: 5, windowHours: 24 };
  }
}

// Alert qaydi (operator_alerts). Best-effort.
export async function recordAlert(admin: Admin, operatorId: string, orderId: string | null, level: 1 | 2 | 3, reason: string): Promise<void> {
  try {
    await admin.from("operator_alerts").insert({ operator_id: operatorId, order_id: orderId, level, reason });
  } catch {
    /* jadval yo'q / xato -> e'tiborsiz */
  }
}

// Reytingni ATOMIK o'zgartirish (RPC: event + profiles.rating += delta).
// Best-effort — reyting yozilmasa ham oqim buzilmaydi.
export async function applyRating(admin: Admin, operatorId: string | null, delta: number, orderId: string | null, reason: string): Promise<void> {
  if (!operatorId) return;
  try {
    await admin.rpc("apply_operator_rating", { p_operator: operatorId, p_delta: delta, p_order: orderId, p_reason: reason });
  } catch {
    /* RPC yo'q / xato -> e'tiborsiz */
  }
}
