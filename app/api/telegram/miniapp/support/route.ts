import { NextRequest, NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";
import { resolveMiniApp } from "@/lib/telegram/resolveMiniApp";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isEffectivelyOnline, withPresenceFallback } from "@/lib/presence";
import { notifyOperatorsSupportMessage } from "@/lib/telegram/notifyStaff";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { reassignStaleThread } from "@/lib/support/staleReassign";
import { insertSupportSystemMessage, claimSupportBusyNotice, resetSupportNoticeFlags } from "@/lib/support/messages";
import { serverT, customerLocale, LOCALE_COOKIE } from "@/lib/i18n/server";

async function resolveCustomerId(initData: string): Promise<string | null> {
  const verified = await resolveMiniApp(initData);
  if (!verified) return null;
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("telegram_id", verified.telegramId)
    .maybeSingle();
  return customer?.id ?? null;
}

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const initData = req.nextUrl.searchParams.get("initData");
  if (!initData) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  // `before` — shu sanadan OLDINGI 50 ta xabar (yuqoriga scroll qilib eski
  // tarixni yuklash uchun). Bo'lmasa — oxirgi 50 ta (chat darhol ochilishi
  // uchun; ilgari har safar 200 tagacha yuklanardi).
  const before = req.nextUrl.searchParams.get("before");

  const customerId = await resolveCustomerId(initData);
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

  // is_system (0104) — tizim xabarini haqiqiy operator javobidan ajratadi
  // ("javob berildi" belgisi uchun). Ustun hali yo'q bo'lsa (0104 qo'yilmagan)
  // so'rov xato beradi -> ustunsiz qayta so'raladi (guarded fallback).
  const BASE_COLS = "id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, reply_to_id, created_at, order_id";
  const runQuery = async (cols: string) => {
    let query = supabase.from("telegram_support_messages").select(cols).eq("customer_id", customerId);
    if (thread?.ended_at) {
      query = query.gt("created_at", thread.ended_at);
    }
    if (before) {
      query = query.lt("created_at", before);
    }
    // Oxiridan PAGE_SIZE tasini olamiz (desc), keyin ekranda ko'rinadigan
    // tartibga (asc) qaytaramiz.
    return query.order("created_at", { ascending: false }).limit(PAGE_SIZE);
  };
  let { data: page, error: pageErr } = await runQuery(`${BASE_COLS}, is_system`);
  if (pageErr) ({ data: page } = await runQuery(BASE_COLS));
  const messages = ((page ?? []) as any[]).slice().reverse();

  return NextResponse.json({ messages, hasMore: messages.length === PAGE_SIZE });
}

export async function POST(req: NextRequest) {
  const botToken = await getApiCredential("telegram_bot_token");
  if (!botToken) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  // 1.4: asosiy cheklov MIJOZ bo'yicha (pastda, autentifikatsiyadan keyin).
  // IP chegarasi qo'shimcha va keng — mobil NAT ortidagi ko'p mijoz bir-birini
  // bloklamasin (avval 20/60s faqat IP bo'yicha edi).
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-support-send:${ip}`, 60, 120);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { initData, message, replyToId, orderId } = body ?? {};
  if (!initData || !message || String(message).trim().length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const customerId = await resolveCustomerId(initData);
  if (!customerId) return NextResponse.json({ error: "not_registered" }, { status: 401 });
  const { allowed: custAllowed } = await checkAndRecordRateLimit(`telegram-support-send-c:${customerId}`, 60, 20);
  if (!custAllowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  // Avto-xabarlar mijoz tilida (1.3): cookie -> initData language_code -> uz.
  const loc = customerLocale(req.cookies.get(LOCALE_COOKIE)?.value, initData);

  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("telegram_support_messages")
    .insert({ customer_id: customerId, sender: "customer", message: String(message).trim().slice(0, 2000), reply_to_id: replyToId ?? null, order_id: orderId ?? null })
    .select("id, sender, message, created_at, order_id")
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

  // 8-BOSQICH: mijozning OWNER operatori (2-bosqich egaligi) bор bo'lsa,
  // support unga yo'naltiriladi (ustunlik). Owner yo'q bo'lsa yuqoridagi
  // mavjud mantiq (tanlangan/oxirgi buyurtma operatori) — umumiy oqim.
  try {
    const { data: cust } = await supabase.from("customers").select("owner_operator_id").eq("id", customerId).maybeSingle();
    if ((cust as any)?.owner_operator_id) servedBy = (cust as any).owner_operator_id;
  } catch {
    /* owner ustuni yo'q -> mavjud mantiq */
  }

  const { data: existingThread } = await supabase
    .from("telegram_support_threads")
    .select("claimed_by, auto_greeted, status, is_archived")
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
  // Egalik bu yerda payload orqali EMAS — upsert'dan keyin ATOMIK (pastda):
  // aks holda "tekshir, keyin yoz" oralig'ida operator olgan egalik ustidan
  // yozilib, uning keyingi javobi rad etilishi mumkin edi.

  // Suhbat boshida bir marta avto-kirish xabari (operator nomidan).
  if (!existingThread?.auto_greeted) {
    threadPayload.auto_greeted = true;
    const greeting = servedBy ? serverT(loc, "spb.greetOwner") : serverT(loc, "spb.greetGeneral");
    // Tizim xabari (1.2): hech kimning nomidan emas. Avval operator_id'siz
    // insert constraint tufayli jimgina rad etilardi.
    await insertSupportSystemMessage(supabase, customerId, greeting);
  }

  // Arxivlangan/yakunlangan thread qayta ochilmoqda = YANGI suhbat: oldingi
  // suhbatning bir martalik ogohlantirish/bildirishnoma belgilari tozalanadi
  // (arxivlash va "tozalash" ularni tozalamaydi).
  if (existingThread && ((existingThread as any).is_archived || existingThread.status === "ended")) {
    await resetSupportNoticeFlags(supabase, customerId);
  }

  await supabase.from("telegram_support_threads").upsert(
    threadPayload,
    { onConflict: "customer_id" }
  );
  if (servedBy) {
    await supabase
      .from("telegram_support_threads")
      .update({ claimed_by: servedBy, claimed_at: nowIso })
      .eq("customer_id", customerId)
      .is("claimed_by", null);
  }

  // 15 daqiqa javobsizlik yoki operator band bo'lsa — jamoaga qaytarish.
  const wasReassigned = await reassignStaleThread(customerId);

  // Operator holatini tekshirib, band bo'lsa mijozga xabar (bir marta).
  const { data: freshThread } = await supabase
    .from("telegram_support_threads")
    .select("claimed_by")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (freshThread?.claimed_by) {
    const ownerId = freshThread.claimed_by;
    const op = await withPresenceFallback<{ is_online: boolean | null; last_seen_at?: string | null }>(
      () => supabase.from("profiles").select("is_online, last_seen_at").eq("id", ownerId).maybeSingle(),
      () => supabase.from("profiles").select("is_online").eq("id", ownerId).maybeSingle()
    );
    // Bitta suhbat davomida BIR MARTA (1.1): atomik busy_notified_at belgisi.
    // Onlayn = is_online + heartbeat (lib/presence.ts).
    if (op && !isEffectivelyOnline(op) && (await claimSupportBusyNotice(supabase, customerId))) {
      // Tizim xabari; 0104 yo'q bo'lsa eski usulda (o'sha operator nomidan).
      await insertSupportSystemMessage(
        supabase,
        customerId,
        serverT(loc, "spb.busy"),
        freshThread.claimed_by
      );
    }
  } else if (wasReassigned && (await claimSupportBusyNotice(supabase, customerId))) {
    // Bir marta (1.1) — avval operator offline bo'lsa mijozning HAR xabarida
    // qayta yuborilardi (egalik har safar qayta tiklanib, yana olinardi).
    // Jamoaga o'tkazildi — TIZIM xabari, ism biriktirilmaydi (1.2). Avval
    // birinchi faol profil (tasodifiy xodim) nomidan yozilardi.
    await insertSupportSystemMessage(
      supabase,
      customerId,
      serverT(loc, "spb.redirected")
    );
  }

  // 2.1: mas'ul operatorga Telegram (throttle bilan; egalik yakuniy holatda).
  await notifyOperatorsSupportMessage(customerId, { kind: "text", text: String(message).trim() });

  return NextResponse.json({ message: inserted });
}
