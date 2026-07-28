import { createAdminClient } from "@/lib/supabaseAdmin";
import { superAdminPosterId } from "@/lib/cashdesk/debt";

// =========================================================
// W2 QO'SHIMCHA — payout urinishlarini cheklash (abuse-himoya).
// Har urinish (muvaffaqiyatli HAM, muvaffaqiyatsiz HAM) payout_attempts
// jadvaliga yoziladi (o'chirilmaydi). Mijoz VA player_id (1xbet/kassa
// hisob ID) alohida-alohida cheklanadi: bittasi 1 soat ichida
// max_failed_per_hour (standart 5) marta muvaffaqiyatsiz urinsa —
// block_hours (standart 24) soatga bloklanadi + adminga signal.
// Muvaffaqiyatli payoutdan keyin ikkalasining ham bloki tozalanadi.
// =========================================================

export type PayoutBlockCheck = { blocked: boolean; reason?: "customer" | "player"; until?: string };

export async function checkPayoutBlocked(customerId: string, playerId: string): Promise<PayoutBlockCheck> {
  const admin = createAdminClient();
  const [{ data: cust }, { data: pblock }] = await Promise.all([
    admin.from("customers").select("payout_blocked_until").eq("id", customerId).maybeSingle(),
    admin.from("payout_player_blocks").select("blocked_until").eq("player_id", playerId).maybeSingle(),
  ]);

  const custUntil = (cust as any)?.payout_blocked_until;
  if (custUntil && new Date(custUntil).getTime() > Date.now()) {
    return { blocked: true, reason: "customer", until: custUntil };
  }
  const playerUntil = (pblock as any)?.blocked_until;
  if (playerUntil && new Date(playerUntil).getTime() > Date.now()) {
    return { blocked: true, reason: "player", until: playerUntil };
  }
  return { blocked: false };
}

async function checkAndBlockIfOverLimit(
  admin: ReturnType<typeof createAdminClient>,
  column: "customer_id" | "player_id",
  value: string,
  maxFailed: number,
  blockHours: number
): Promise<void> {
  const { data: lastSuccess } = await admin
    .from("payout_attempts")
    .select("created_at")
    .eq(column, value)
    .eq("ok", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const sinceSuccess = (lastSuccess as any)?.created_at as string | undefined;
  // Oxirgi muvaffaqiyatdan keyingi muvaffaqiyatsizliklarnigina sanaymiz
  // ("muvaffaqiyatli payoutdan keyin hisob nolga tushadi") — VA baribir
  // 1 soatlik oynadan tashqarisi hisobga olinmaydi.
  const cutoff = sinceSuccess && sinceSuccess > hourAgo ? sinceSuccess : hourAgo;

  const { count } = await admin
    .from("payout_attempts")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .eq("ok", false)
    .gt("created_at", cutoff);

  if ((count ?? 0) < maxFailed) return;

  const until = new Date(Date.now() + blockHours * 3600_000).toISOString();
  if (column === "customer_id") {
    await admin.from("customers").update({ payout_blocked_until: until }).eq("id", value);
  } else {
    await admin.from("payout_player_blocks").upsert({ player_id: value, blocked_until: until, updated_at: new Date().toISOString() });
  }

  try {
    const poster = await superAdminPosterId(admin);
    if (poster) {
      const label = column === "customer_id" ? "Mijoz" : "Hisob (player_id)";
      await admin.from("team_chat_messages").insert({
        sender_id: poster,
        is_system: true,
        event_type: "alert",
        message: `🟥 Tizim: ${label} (${value}) payout'da ketma-ket ${count} marta muvaffaqiyatsiz urindi — ${blockHours} soatga bloklandi.`,
      });
    }
  } catch {
    /* signal best-effort */
  }
}

export async function recordPayoutAttempt(params: {
  customerId: string;
  playerId: string;
  ok: boolean;
  error: string | null;
  ip: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("payout_attempts").insert({
    customer_id: params.customerId,
    player_id: params.playerId,
    ok: params.ok,
    error: params.error,
    ip: params.ip,
  });

  if (params.ok) {
    // Muvaffaqiyatli bo'lsa — hisob nolga tushadi (mavjud bloklar tozalanadi).
    try {
      await admin.from("customers").update({ payout_blocked_until: null }).eq("id", params.customerId);
      await admin.from("payout_player_blocks").delete().eq("player_id", params.playerId);
    } catch {
      /* tozalash best-effort */
    }
    return;
  }

  const { data: settingsRow } = await admin.from("site_settings").select("value").eq("key", "betcore_payout_limits").maybeSingle();
  const settings = (settingsRow?.value as any) ?? {};
  const maxFailed = Number(settings.max_failed_per_hour) || 5;
  const blockHours = Number(settings.block_hours) || 24;

  try {
    await checkAndBlockIfOverLimit(admin, "customer_id", params.customerId, maxFailed, blockHours);
    await checkAndBlockIfOverLimit(admin, "player_id", params.playerId, maxFailed, blockHours);
  } catch {
    /* limit-tekshiruv best-effort — payout natijasini o'zini bloklamaydi */
  }
}
