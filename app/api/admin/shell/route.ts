import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCashdeskBalance } from "@/lib/cashdesk/client";
import { listCashdesks, getCashdeskCredsById, getDefaultCashdeskCreds } from "@/lib/cashdesk/store";

// Admin "shell" uchun jonli ma'lumot: balans, SLA, badge sanoqlari, operator holati.
// Bitta yengil endpoint — layout uni ~30s'da bir marta chaqiradi (poll).
// QOIDA: bu shell FAQAT bizning tomon uchun. Hamkor (partner_members) bo'lsa
// isPartner=true qaytadi va klient shell'ni ko'rsatmaydi (aggregat ichki
// ma'lumot hamkorga chiqmaydi).
//
// Har blok mustaqil try/catch — migratsiya/ruxsat yetishmasa ham 500 bermaydi,
// shunchaki o'sha maydon null/0 bo'ladi (mavjud best-effort uslub).

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Ruxsatlar
  const [{ data: canManageOrders }, { data: canOversight }] = await Promise.all([
    supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" }),
    supabase.rpc("has_permission", { perm_key: "operators.oversight" }),
  ]);

  // Rol + hamkormi
  let role: string | null = null;
  let roleId: string | null = null;
  let isPartner = false;
  let me = { name: "", rating: 0, isBusy: false, busyReason: "" as string | null };
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name, full_name, rating, is_busy, busy_reason, role_id, roles(key)")
      .eq("id", user.id)
      .maybeSingle();
    if (prof) {
      role = (prof as any).roles?.key ?? null;
      roleId = (prof as any).role_id ?? null;
      me = {
        name: (prof as any).display_name || (prof as any).full_name || "",
        rating: Number((prof as any).rating ?? 0),
        isBusy: !!(prof as any).is_busy,
        busyReason: (prof as any).busy_reason ?? "",
      };
    }
  } catch {
    /* profiles o'qilmadi */
  }

  // Foydalanuvchining barcha ruxsat kalitlari (command palette natijalarini
  // filtrlash uchun — har biriga alohida RPC o'rniga bitta so'rov).
  let perms: string[] = [];
  try {
    if (roleId) {
      const { data: rp } = await admin.from("role_permissions").select("permissions(key)").eq("role_id", roleId);
      perms = (rp ?? []).map((r: any) => r.permissions?.key).filter(Boolean);
    }
  } catch {
    /* skip */
  }
  try {
    const { data: pm } = await admin.from("partner_members").select("id").eq("profile_id", user.id).maybeSingle();
    isPartner = !!pm;
  } catch {
    /* partner_members yo'q -> ichki foydalanuvchi */
  }

  // Hamkorga umuman ma'lumot bermaymiz (qoida)
  if (isPartner) {
    return NextResponse.json({ isPartner: true, shell: false }, { headers: { "Cache-Control": "no-store" } });
  }

  // ---- Badge sanoqlari (arzon DB so'rovlari) ----
  const counts = {
    pendingOrders: 0,
    openDebts: 0,
    onlineOperators: 0,
    totalOperators: 0,
    teamChatLatestAt: null as string | null,
    teamChatTotal: 0,
    cashdesksLow: null as number | null,
  };

  // Kutilayotgan buyurtmalar
  try {
    const { count } = await admin
      .from("telegram_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    counts.pendingOrders = count ?? 0;
  } catch {
    /* skip */
  }

  // Ochiq qarzlar (mening ishtirokimdagi, to'lanmagan)
  try {
    const { data: debts } = await admin
      .from("operator_debts")
      .select("status, debtor_operator_id, creditor_operator_id")
      .neq("status", "paid");
    counts.openDebts = (debts ?? []).filter(
      (d: any) => d.debtor_operator_id === user.id || d.creditor_operator_id === user.id,
    ).length;
  } catch {
    /* skip */
  }

  // Operatorlar: onlayn / jami
  try {
    const { data: ops } = await admin
      .from("profiles")
      .select("is_online, roles!inner(key)")
      .eq("roles.key", "operator");
    const list = (ops ?? []) as any[];
    counts.totalOperators = list.length;
    counts.onlineOperators = list.filter((o) => o.is_online).length;
  } catch {
    /* skip */
  }

  // Jamoa chati: eng so'nggi xabar vaqti + jami (klient localStorage bilan o'qilmaganni hisoblaydi)
  try {
    const { count } = await admin.from("team_chat_messages").select("id", { count: "exact", head: true });
    counts.teamChatTotal = count ?? 0;
    const { data: last } = await admin
      .from("team_chat_messages")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    counts.teamChatLatestAt = (last as any)?.created_at ?? null;
  } catch {
    /* skip */
  }

  // Eng yaqin SLA muddati (kutilayotgan buyurtmalar orasida)
  let slaDeadline: string | null = null;
  try {
    const nowIso = new Date(Date.now()).toISOString();
    const { data: sla } = await admin
      .from("telegram_orders")
      .select("sla_deadline")
      .eq("status", "pending")
      .not("sla_deadline", "is", null)
      .gte("sla_deadline", nowIso)
      .order("sla_deadline", { ascending: true })
      .limit(1)
      .maybeSingle();
    slaDeadline = (sla as any)?.sla_deadline ?? null;
  } catch {
    /* skip */
  }

  // ---- Jonli 1xBet chaqiruvlari (sekin bo'lishi mumkin -> timeout bilan) ----
  let balance: { configured: boolean; balance: number | null; limit: number | null } | null = null;
  if (canManageOrders) {
    balance = await withTimeout(
      (async () => {
        try {
          const creds = await getDefaultCashdeskCreds();
          const r = await getCashdeskBalance(creds ?? undefined);
          if (!r.ok) return { configured: r.error !== "not_configured", balance: null, limit: null };
          return { configured: true, balance: r.data.Balance, limit: r.data.Limit };
        } catch {
          return { configured: false, balance: null, limit: null };
        }
      })(),
      4000,
      { configured: true, balance: null, limit: null },
    );
  }

  // Limitdan past kassalar soni — faqat nazoratchi (super) uchun, yuk kamaytirish
  if (canOversight) {
    counts.cashdesksLow = await withTimeout(
      (async () => {
        try {
          const desks = (await listCashdesks()).filter((d) => d.is_active && d.low_balance_threshold != null);
          const results = await Promise.allSettled(
            desks.map(async (d) => {
              const creds = await getCashdeskCredsById(d.id);
              if (!creds) return false;
              const r = await getCashdeskBalance(creds);
              if (!r.ok || r.data.Balance == null) return false;
              return Number(r.data.Balance) < Number(d.low_balance_threshold);
            }),
          );
          return results.filter((x) => x.status === "fulfilled" && x.value).length;
        } catch {
          return null as number | null;
        }
      })(),
      5000,
      null,
    );
  }

  return NextResponse.json(
    {
      shell: true,
      isPartner: false,
      role,
      perms,
      canManageOrders: !!canManageOrders,
      canOversight: !!canOversight,
      me,
      counts,
      balance,
      slaDeadline,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
