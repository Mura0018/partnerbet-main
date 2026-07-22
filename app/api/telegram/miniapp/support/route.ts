import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { verifyTelegramInitData } from "@/lib/telegram/verifyInitData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { reassignStaleThread } from "@/lib/support/staleReassign";

async function resolveCustomerId(initData: string, botToken: string): Promise<string | null> {
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) return null;
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  return customer?.id ?? null;
}

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const customerId = await resolveCustomerId(initData, botToken);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();

  // Yakunlangan suhbat mijoz tomonida ko'rinmaydi: thread oxirgi marta
  // yakunlanganda (ended_at) faqat o'shandan keyingi (yangi sessiya) xabarlar
  // qaytadi. ended_at bo'lmasa hammasi. Operator paneli to'liq tarixni alohida
  // (admin) endpoint orqali ko'radi — bu filtr faqat mijoz GET'iga taalluqli.
  const { data: thread } = await supabase
    .from("telegram_support_threads")
    .select("ended_at")
    .eq("customer_id", customerId)
    .maybeSingle();

  let query = supabase
    .from("telegram_support_messages")
    .select("id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, reply_to_id, created_at")
    .eq("customer_id", customerId);
  if (thread?.ended_at) {
    query = query.gt("created_at", thread.ended_at);
  }
  const { data: messages } = await query.order("created_at", { ascending: true }).limit(200);

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-send:${ip}`, 60, 20);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, message, replyToId, orderId } = body ?? {};
  if (!initData || !message || String(message).trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const customerId = await resolveCustomerId(initData, botToken);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "customer", message: String(message).trim().slice(0, 2000), reply_to_id: replyToId ?? null })
    .select("id, sender, message, created_at")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  // Operatorni aniqlash: mijoz aniq bir buyurtmani tanlagan bo'lsa (orderId),
  // o'sha buyurtma operatoriga; aks holda oxirgi buyurtmasi operatoriga.
  let servedBy: string | null = null;
  let linkedOrderId: string | null = null;
  if (orderId) {
    const { data: chosen } = await supabase
      .from("telegram_orders")
      .select("id, operator_id, claimed_by")
      .eq("id", orderId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (chosen) {
      servedBy = chosen.operator_id ?? chosen.claimed_by ?? null;
      linkedOrderId = chosen.id;
    }
  }
  if (!servedBy) {
    const { data: lastOrder } = await supabase
      .from("telegram_orders")
      .select("id, operator_id, claimed_by")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    servedBy = lastOrder?.operator_id ?? lastOrder?.claimed_by ?? null;
    if (!linkedOrderId) linkedOrderId = lastOrder?.id ?? null;
  }

  const { data: existingThread } = await supabase
    .from("telegram_support_threads")
    .select("claimed_by, auto_greeted, status")
    .eq("customer_id", customerId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const threadPayload: any = {
    customer_id: customerId,
    is_archived: false,
    status: "open",
    updated_at: nowIso,
    last_customer_message_at: nowIso,
  };
  if (linkedOrderId) threadPayload.linked_order_id = linkedOrderId;
  if (servedBy && !existingThread?.claimed_by) {
    threadPayload.claimed_by = servedBy;
    threadPayload.claimed_at = nowIso;
  }

  // Suhbat boshida bir marta avto-kirish xabari (operator nomidan).
  if (!existingThread?.auto_greeted) {
    threadPayload.auto_greeted = true;
    const greeting = servedBy
      ? "Assalomu alaykum! Sizga tegishli operator hozir band bo'lishi mumkin. \ud83d\udd52 Savolingizni yozib qoldiring — imkon qadar tez javob beramiz. \ud83d\ude4f \ud83d\ude4f"
      : "Assalomu alaykum! BetCore Pay qo'llab-quvvatlash xizmatiga xush kelibsiz! \ud83d\udc4b Savolingizni yozing — operatorlarimiz tez orada javob beradi. \ud83d\ude4a \ud83d\ude4f";
    await supabase
      .from("telegram_support_messages")
      .insert({ customer_id: customerId, sender: "operator", message: greeting });
  }

  await supabase.from("telegram_support_threads").upsert(
    threadPayload,
    { onConflict: "customer_id" }
  );

  // 15 daqiqa javobsizlik yoki operator band bo'lsa — jamoaga qaytarish.
  const wasReassigned = await reassignStaleThread(customerId);

  // Operator holatini tekshirib, band bo'lsa mijozga xabar (bir marta).
  const { data: freshThread } = await supabase
    .from("telegram_support_threads")
    .select("claimed_by")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (freshThread?.claimed_by) {
    const { data: op } = await supabase
      .from("profiles")
      .select("is_online")
      .eq("id", freshThread.claimed_by)
      .maybeSingle();
    if (op && !op.is_online) {
      await supabase.from("telegram_support_messages").insert({
        customer_id: customerId,
        sender: "operator",
        operator_id: freshThread.claimed_by,
        message: "Operatoringiz hozir band \ud83d\udd34 Tez orada javob beramiz yoki boshqa operator ulanadi. \ud83d\ude4f",
      });
    }
  } else if (wasReassigned) {
    // Jamoaga o'tkazildi — mijozga xabar (operator_id yo'q, shuning uchun
    // customer emas, lekin constraint operator uchun id talab qiladi.
    // Buning uchun jamoadagi birinchi super_admin id sini olamiz.)
    const { data: anyAdmin } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (anyAdmin) {
      await supabase.from("telegram_support_messages").insert({
        customer_id: customerId,
        sender: "operator",
        operator_id: anyAdmin.id,
        message: "So'rovingiz jamoamizga yo'naltirildi \ud83d\udd04 Tez orada operator javob beradi.",
      });
    }
  }

  return NextResponse.json({ message: inserted });
}
