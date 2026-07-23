import { createAdminClient } from "@/lib/supabaseAdmin";

// 6-BOSQICH qarz yordamchilari. Hammasi best-effort — asosiy buyurtma
// oqimini (bajarish) HECH QACHON buzmaydi.

export type DebtSettings = { limit: number; escalationHours: number };

// site_settings.cashdesk_debt = {"limit": N, "escalation_hours": H}
// limit 0/yo'q = cheksiz (avtomatik band qilmaydi). escalation standart 24.
export async function getDebtSettings(): Promise<DebtSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("site_settings").select("value").eq("key", "cashdesk_debt").maybeSingle();
    const v = (data?.value as any) ?? {};
    const limit = Number(v.limit);
    const eh = Number(v.escalation_hours);
    return {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 0,
      escalationHours: Number.isFinite(eh) && eh > 0 ? eh : 24,
    };
  } catch {
    return { limit: 0, escalationHours: 24 };
  }
}

// Operatorning OCHIQ (paid emas) qarzlari yig'indisi (u qarzdor bo'lganlar).
export async function operatorOpenDebtTotal(admin: ReturnType<typeof createAdminClient>, operatorId: string): Promise<number> {
  const { data } = await admin
    .from("operator_debts")
    .select("amount")
    .eq("debtor_operator_id", operatorId)
    .neq("status", "paid");
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
}

// Qarz limiti oshsa -> operatorni AVTOMATIK band qiladi (yangi buyurtma
// olmaydi) + jamoa chatiga admin ogohlantirish. Limit 0/cheksiz bo'lsa hech
// narsa qilmaydi. Best-effort.
export async function enforceDebtLimit(admin: ReturnType<typeof createAdminClient>, operatorId: string): Promise<void> {
  try {
    const { limit } = await getDebtSettings();
    if (!limit || limit <= 0) return; // cheksiz -> band qilmaydi

    const total = await operatorOpenDebtTotal(admin, operatorId);
    if (total <= limit) return;

    // Avtomatik band (faqat hozir bo'sh bo'lsa — mavjud band holatini bosib o'tmaymiz)
    await admin
      .from("profiles")
      .update({ is_busy: true, busy_reason: `Qarz limiti oshdi (${total.toLocaleString("ru-RU")} so'm)` })
      .eq("id", operatorId)
      .eq("is_busy", false);

    const { data: prof } = await admin.from("profiles").select("display_name, full_name").eq("id", operatorId).maybeSingle();
    const name = (prof as any)?.display_name || (prof as any)?.full_name || "Operator";

    const poster = await superAdminPosterId(admin);
    if (poster) {
      await admin.from("team_chat_messages").insert({
        sender_id: poster,
        is_system: true,
        message: `⚠️ Tizim: ${name} qarz limitidan oshdi (${total.toLocaleString("ru-RU")} so'm) va avtomatik band qilindi.`,
      });
    }
  } catch {
    /* best-effort */
  }
}

// Tizim xabarini kim nomidan yozamiz — birinchi aktiv super_admin.
export async function superAdminPosterId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  try {
    const { data: role } = await admin.from("roles").select("id").eq("key", "super_admin").maybeSingle();
    if (!role) return null;
    const { data: sa } = await admin
      .from("profiles")
      .select("id")
      .eq("role_id", (role as any).id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (sa as any)?.id ?? null;
  } catch {
    return null;
  }
}
