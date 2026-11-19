"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatPhone, formatAccountId, formatTime } from "@/lib/format";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDelayedFlag } from "@/lib/ui/appear";
import { toast } from "@/lib/ui/toast";
import { useConfirm } from "@/lib/ui/useConfirm";

type SupportThread = {
  customer_id: string; phone: string; full_name: string | null; last_message: string | null; last_image: boolean; last_at: string;
  claimed_by: string | null; claimed_by_name: string | null;
  // 2.2: oxirgi HAQIQIY operator javobidan keyingi eng eski mijoz xabari
  // vaqti (null = javob berilgan / mijoz xabari yo'q).
  unanswered_since: string | null;
};
// Operator suhbat oynasida bir sahifadagi xabarlar soni (mijoz tomoni bilan bir xil).
const THREAD_PAGE = 50;
// Ro'yxat: faol suhbatlar (amalda kichik) va oxirgi arxivlanganlar.
const ACTIVE_THREADS_LIMIT = 500;
const ARCHIVED_THREADS_LIMIT = 200;
// Shu daqiqadan uzoq javobsiz turgan suhbat ajralib turadi (staleReassign
// bilan bir xil 15 daqiqa).
const SUPPORT_WAIT_ALERT_MIN = 15;

// "12 daq" / "2 soat 5 daq" / "3 kun" — lug'at kalitlari orqali.
function formatWait(t: (k: any, v?: any) => string, sinceIso: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(sinceIso).getTime()) / 60000));
  if (mins < 60) return t("sup.waitMin", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rest = mins % 60;
    return rest ? `${t("sup.waitHour", { n: hours })} ${t("sup.waitMin", { n: rest })}` : t("sup.waitHour", { n: hours });
  }
  return t("sup.waitDay", { n: Math.floor(hours / 24) });
}
type SupportMsg = {
  id: string; sender: "customer" | "operator"; message: string | null; image_path: string | null;
  file_name: string | null; voice_path: string | null; voice_duration_seconds: number | null; reply_to_id: string | null; created_at: string;
};

const REPLY_TEMPLATE_KEYS = [
  "sup.tpl1",
  "sup.tpl2",
  "sup.tpl3",
  "sup.tpl4",
  "sup.tpl5",
  "sup.tpl6",
];

function SupportImage({ path }: { path: string }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Xato (HTTP xato, url yo'q yoki tarmoq) -> "Rasm ochilmadi" + qayta urinish.
  // Ilgari url null bo'lib qolar va "yuklanmoqda" matni abadiy turardi.
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(`/api/admin/telegram-orders/support-image-url?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && data?.url) setUrl(data.url);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path, attempt]);
  const showLoading = useDelayedFlag(!url && !failed);

  if (!url && failed) {
    return (
      <p className="text-[11px] text-[#FF6B85]">
        {t("sup.imgFailed")}{" "}
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="underline text-muted hover:text-white">
          {t("sup.imgRetry")}
        </button>
      </p>
    );
  }
  if (!url) return showLoading ? <p className="text-[11px] text-muted">{t("sup.imgLoading")}</p> : null;

  return (
    <>
      <img src={url} alt="Mijoz yuborgan rasm" onClick={() => setExpanded(true)} className="max-w-[180px] rounded-lg cursor-zoom-in transition-transform active:scale-95" />
      {expanded && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-5" onClick={() => setExpanded(false)}>
          <img src={url} alt="Mijoz yuborgan rasm" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

// Fullscreen thread view — opened when a thread is selected from the list.
function SupportVoice({ path }: { path: string }) {
  const { t } = useLocale();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/telegram-orders/support-image-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => setUrl(data.url ?? null))
      .catch(() => setUrl(null));
  }, [path]);
  const showLoading = useDelayedFlag(!url);

  // Pleyer balandligi (h-9) oldindan band qilinadi — url kelganda xabar
  // pufagi sakramaydi; matn faqat cho'zilsa chiqadi.
  if (!url) {
    return (
      <div className="h-9 flex items-center">
        {showLoading ? <p className="text-[11px] text-muted">{t("sup.audioLoading")}</p> : null}
      </div>
    );
  }
  return <audio controls src={url} className="max-w-[220px] h-9" />;
}

function SupportThreadView({ thread, currentUserId, onBack, onArchived, active = true }: { thread: SupportThread; currentUserId: string | null; onBack: () => void; onArchived: () => void; active?: boolean }) {
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const [msgs, setMsgs] = useState<SupportMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [claimedBy, setClaimedBy] = useState(thread.claimed_by);
  const [claimedByName, setClaimedByName] = useState(thread.claimed_by_name);
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const [orderFlipped, setOrderFlipped] = useState(false);
  const [replyTo, setReplyTo] = useState<SupportMsg | null>(null);
  const [myTheme, setMyTheme] = useState<string>("blue");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const voiceRecorder = useVoiceRecorder();
  const supabase = createClient();
  const { confirm, confirmDialog } = useConfirm();

  // Mijoz tomonidagi naqsh (miniapp/support GET): oxirgi THREAD_PAGE ta xabar
  // (desc + reverse); tepaga scroll qilinganda eskilari `before` bilan.
  // Avval eng ESKI 200 ta yuklanardi — uzun suhbatda yangi xabar ko'rinmasdi.
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const MSG_COLS = "id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, reply_to_id, created_at";

  const loadThread = async () => {
    const { data } = await supabase
      .from("telegram_support_messages")
      .select(MSG_COLS)
      .eq("customer_id", thread.customer_id)
      .order("created_at", { ascending: false })
      .limit(THREAD_PAGE);
    const batch = ((data as any[]) ?? []).slice().reverse() as SupportMsg[];
    setMsgs((prev) => {
      // Birinchi yuklash: "yana bor"mi — sahifa to'liq bo'lsa.
      if (prev.length === 0) {
        setHasMoreOlder(batch.length === THREAD_PAGE);
        return batch;
      }
      // Polling: oxirgi sahifa yangilanadi, ilgari yuklangan ESKI xabarlar saqlanadi.
      const oldestNewMs = batch.length ? Date.parse(batch[0].created_at) : Infinity;
      const older = prev.filter((m) => Date.parse(m.created_at) < oldestNewMs);
      return [...older, ...batch];
    });
  };

  const loadOlder = async () => {
    if (loadingOlder || !hasMoreOlder || msgs.length === 0) return;
    const list = listRef.current;
    const prevHeight = list?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const { data } = await supabase
        .from("telegram_support_messages")
        .select(MSG_COLS)
        .eq("customer_id", thread.customer_id)
        .lt("created_at", msgs[0].created_at)
        .order("created_at", { ascending: false })
        .limit(THREAD_PAGE);
      const older = ((data as any[]) ?? []).slice().reverse() as SupportMsg[];
      setHasMoreOlder(older.length === THREAD_PAGE);
      if (older.length) {
        setMsgs((prev) => [...older.filter((o) => !prev.some((p) => p.id === o.id)), ...prev]);
        // Scroll joyi saqlanadi (yuqoriga qo'shilgan balandlik qadar suriladi).
        requestAnimationFrame(() => {
          if (list) list.scrollTop += list.scrollHeight - prevHeight;
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  };

  // Tab yashirin (active=false) paytda polling to'xtaydi; qaytganda darhol
  // bir marta yangilanadi va davom etadi.
  useEffect(() => {
    loadThread();
  }, [thread.customer_id]);
  const threadPollStartedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (threadPollStartedRef.current) loadThread();
    threadPollStartedRef.current = true;
    const interval = setInterval(loadThread, 4000);
    return () => clearInterval(interval);
  }, [thread.customer_id, active]);

  // Biriktirilgan buyurtmani (thread.linked_order_id) olamiz — operator ham
  // buyurtма kartаsини ko'radi (bosса 3D aylanib holat/izoh chiqadi).
  const loadLinkedOrder = async () => {
    const { data: t } = await supabase.from("telegram_support_threads").select("linked_order_id").eq("customer_id", thread.customer_id).maybeSingle();
    const oid = (t as any)?.linked_order_id;
    if (!oid) { setLinkedOrder(null); return; }
    const { data: o } = await supabase.from("telegram_orders").select("id, type, amount, platform, account_id, status, operator_note, payment_method").eq("id", oid).maybeSingle();
    setLinkedOrder(o ?? null);
  };
  useEffect(() => {
    loadLinkedOrder();
  }, [thread.customer_id]);
  const orderPollStartedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (orderPollStartedRef.current) loadLinkedOrder();
    orderPollStartedRef.current = true;
    const iv = setInterval(loadLinkedOrder, 5000);
    return () => clearInterval(iv);
  }, [thread.customer_id, active]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("chat_theme").eq("id", user.id).maybeSingle();
      if (data?.chat_theme) setMyTheme(data.chat_theme);
    });
  }, []);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    // Bo'sh ro'yxatда firstScrollRef sarflanmasin — xabar yuklangaндан keyin
    // pastga (oxirgi xabarga) tushsin (aks holda yuqorида qolib ketardi).
    if (msgs.length === 0) return;
    // Birinchi ochilishda darhol (animatsiyasiz) pastga.
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      bottom.scrollIntoView({ behavior: "auto" });
      return;
    }
    // Keyingi yangi xabarlarda: faqat foydalanuvchi pastga yaqin bo'lsa sur
    // (tepada eski xabarlarni o'qiyotgan bo'lsa polling uni tortmaydi).
    const list = listRef.current;
    if (list && list.scrollHeight - list.scrollTop - list.clientHeight >= 80) return;
    bottom.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const reply = async () => {
    if (sending || !text.trim()) return;
    setSending(true);
    try {
      await fetch("/api/admin/telegram-orders/support-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id, message: text.trim(), replyToId: replyTo?.id ?? null }),
      });
      setText("");
      setReplyTo(null);
      await loadThread();
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = (id: string) => {
    confirm(t("sup.confirmDeleteMsg"), async () => {
      await fetch("/api/admin/telegram-orders/support-delete-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: id }),
      });
      await loadThread();
    });
  };

  const messageById = (id: string | null) => (id ? msgs.find((m) => m.id === id) ?? null : null);

  // Server chegarasi (300 s) bilan bir xil — oshib ketgan yozuv rad etilib
  // yo'qolmasligi uchun 300 s da avtomatik to'xtab yuboriladi.
  useEffect(() => {
    if (voiceRecorder.recording && voiceRecorder.durationSeconds >= 300) void stopAndSendVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRecorder.recording, voiceRecorder.durationSeconds]);

  const stopAndSendVoice = async () => {
    const recorded = await voiceRecorder.stop();
    if (!recorded || recorded.durationSeconds < 1) return;
    setSending(true);
    try {
      const audioBase64 = await blobToBase64(recorded.blob);
      const res = await fetch("/api/admin/telegram-orders/support-reply-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id, audioBase64, mimeType: recorded.mimeType, durationSeconds: recorded.durationSeconds }),
      });
      // Avval javob tekshirilmasdi — chegaradan oshgan ovoz jim yo'qolardi.
      if (!res.ok) toast.error(t("sup.voiceFailed"));
      await loadThread();
    } finally {
      setSending(false);
    }
  };

  const archive = async () => {
    setArchiving(true);
    try {
      await fetch("/api/admin/telegram-orders/support-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id, archived: true }),
      });
      onArchived();
    } finally {
      setArchiving(false);
    }
  };

  const endChat = () => {
    confirm(t("sup.confirmEnd"), async () => {
      setArchiving(true);
      try {
        const res = await fetch("/api/admin/telegram-orders/support-end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: thread.customer_id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("[support] yakunlanmadi:", data.error);
          toast.error(t("sup.errPrefix"));
        } else {
          toast.success(t("sup.endSent"));
        }
      } finally {
        setArchiving(false);
      }
    });
  };

  const takeOver = async () => {
    // Server marshruti orqali (0103: brauzer bu jadvalga yoza olmaydi).
    // Muvaffaqiyatsiz bo'lsa holat o'zgarmaydi — ilgari xato jim o'tib,
    // UI noto'g'ri "siz javob beryapsiz" deb ko'rsatardi.
    try {
      const res = await fetch("/api/admin/telegram-orders/support-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id, takeOver: true }),
      });
      if (!res.ok) { toast.error(t("sup.claimFailed")); return; }
    } catch {
      toast.error(t("sup.claimFailed"));
      return;
    }
    const { data } = await supabase.from("profiles").select("display_name, full_name").eq("id", currentUserId).maybeSingle();
    setClaimedBy(currentUserId);
    setClaimedByName(data?.display_name || data?.full_name || null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 bg-white/[0.04] backdrop-blur-md border-b border-subtle shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10" aria-label={t("sup.back")}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold truncate">{thread.full_name || formatPhone(thread.phone)}</h1>
        </div>
        <button
          onClick={endChat}
          disabled={archiving}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/25 text-accent hover:bg-accent/25 disabled:opacity-50"
        >
          {t("sup.end")}
        </button>
        <button
          onClick={archive}
          disabled={archiving}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 border border-subtle text-muted hover:text-white disabled:opacity-50"
        >
          {archiving ? "…" : t("sup.archive")}
        </button>
      </div>

      {claimedBy && claimedBy !== currentUserId ? (
        <div className="flex items-center justify-between gap-2 px-5 py-2 bg-[#F4C76A]/10 backdrop-blur-md border-b border-[#F4C76A]/15 shrink-0">
          <span className="text-[11px] text-[#F4C76A]">🔵 {claimedByName || t("sup.otherOp")} {t("sup.answering")}</span>
          <button onClick={takeOver} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-white">{t("sup.takeOver")}</button>
        </div>
      ) : claimedBy === currentUserId ? (
        <div className="px-5 py-1.5 bg-accent/10 backdrop-blur-md border-b border-accent/10 shrink-0">
          <span className="text-[10.5px] text-accent">🔵 {t("sup.youAnswering")}</span>
        </div>
      ) : null}

      {/* Desktopda xabar ustuni cheksiz cho'zilmasin — markazlashgan ustun. */}
      <div className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto">

      {linkedOrder && (
        <div className="px-3 pt-2 shrink-0" style={{ perspective: 1000 }}>
          <button onClick={() => setOrderFlipped((v) => !v)} className="block w-full text-left">
            <div style={{ position: "relative", transformStyle: "preserve-3d", transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)", transform: orderFlipped ? "rotateY(180deg)" : "rotateY(0deg)", minHeight: 82 }}>
              <div style={{ backfaceVisibility: "hidden" }} className="rounded-xl glass-card backdrop-blur-md p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[12.5px] font-semibold text-white">{linkedOrder.type === "topup" ? t("sup.topup") : t("sup.withdraw")}</span>
                  <span className="text-[11px] font-semibold" style={{ color: linkedOrder.status === "completed" ? "#4ADE80" : linkedOrder.status === "rejected" ? "#FF6B85" : "#F4C76A" }}>
                    {linkedOrder.status === "completed" ? t("sup.stCompleted") : linkedOrder.status === "rejected" ? t("sup.stRejected") : t("sup.stPending")}
                  </span>
                </div>
                <div className="text-[11px] text-white/40">{linkedOrder.platform} · {formatAccountId(linkedOrder.account_id)}</div>
                <div className="text-[14px] font-bold text-white mt-0.5">{Number(linkedOrder.amount).toLocaleString("ru-RU")} {t("common.som")}</div>
                <div className="text-[9px] text-white/30 mt-1">{t("sup.tapHint")}</div>
              </div>
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }} className="rounded-xl border border-subtle bg-white/[0.06] backdrop-blur-md p-3 flex flex-col justify-center">
                <div className="text-[11.5px] font-semibold" style={{ color: linkedOrder.status === "completed" ? "#4ADE80" : linkedOrder.status === "rejected" ? "#FF6B85" : "#F4C76A" }}>
                  {linkedOrder.status === "completed" ? t("sup.doneMark") : linkedOrder.status === "rejected" ? t("sup.rejMark") : t("sup.pendMark")}
                </div>
                <div className="text-[11.5px] text-white/70 mt-1 leading-snug">{linkedOrder.operator_note || t("sup.noNote")}</div>
              </div>
            </div>
          </button>
        </div>
      )}

      <div
        ref={listRef}
        onScroll={(e) => { if (e.currentTarget.scrollTop < 60) void loadOlder(); }}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        {loadingOlder && <div className="flex justify-center py-1"><Loader2 size={14} className="animate-spin text-muted" /></div>}
        {msgs.length === 0 && <p className="text-[12px] text-muted text-center mt-8">{t("sup.noMessages")}</p>}
        {msgs.map((m) => {
          const quoted = messageById(m.reply_to_id);
          const quotedLabel = quoted ? (quoted.sender === "operator" ? t("sup.operator") : t("sup.customer")) : null;
          return (
          <div key={m.id} className={`flex flex-col ${m.sender === "operator" ? "items-end" : "items-start"}`}>
            <span className="text-[9px] text-[#5b6f85] mb-0.5 px-1">{m.sender === "operator" ? t("sup.youOperator") : t("sup.customer")}</span>
            <div
              className={`max-w-[78%] rounded-xl px-3 py-2 text-[12.5px] leading-snug ${m.sender === "operator" ? "text-white shadow-lg shadow-black/20" : "bg-white/10 backdrop-blur-md border border-subtle"}`}
              style={m.sender === "operator" ? { background: chatThemeGradient(myTheme) } : undefined}
            >
              {quoted && (
                <div className={`mb-1.5 rounded-lg border-l-[3px] pl-2.5 pr-2 py-1 ${m.sender === "operator" ? "border-subtle bg-white/10" : "border-accent/70 bg-accent/10"}`}>
                  <div className={`text-[10px] font-semibold ${m.sender === "operator" ? "text-white/90" : "text-accent"}`}>{quotedLabel}</div>
                  <div className="text-[10.5px] opacity-70 line-clamp-2 break-words">
                    {quoted.message || (quoted.image_path ? t("sup.image") : quoted.voice_path ? t("sup.voice") : "")}
                  </div>
                </div>
              )}
              {m.voice_path ? (
                <SupportVoice path={m.voice_path} />
              ) : m.image_path ? (
                <div>
                  <SupportImage path={m.image_path} />
                  {m.file_name && <div className="text-[9px] text-white/50 mt-1 truncate max-w-[180px]">{m.file_name}</div>}
                </div>
              ) : (
                (m.message ?? "").replace("__END_CONFIRM__", "")
              )}
              <div className="text-[8px] text-white/40 mt-1">{formatTime(m.created_at, { timeZone: tz })}</div>
            </div>
            <div className={`flex items-center gap-2.5 mt-0.5 px-1 ${m.sender === "operator" ? "flex-row-reverse" : ""}`}>
              <button onClick={() => setReplyTo(m)} className="text-[9px] text-[#5b6f85] hover:text-white flex items-center gap-0.5">
                <Reply size={9} /> {t("sup.reply")}
              </button>
              {m.sender === "operator" && (
                <button onClick={() => deleteMessage(m.id)} className="text-[9px] text-[#5b6f85] hover:text-[#FF6B85] flex items-center gap-0.5">
                  <Trash2 size={9} /> {t("sup.del")}
                </button>
              )}
            </div>
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 bg-white/[0.04] backdrop-blur-md border-t border-subtle">
        {REPLY_TEMPLATE_KEYS.map((tk, i) => {
          const tpl = t(tk as any);
          return (
          <button
            key={i}
            onClick={() => setText(tpl)}
            className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-white/[0.06] backdrop-blur-md border border-subtle text-muted hover:text-white hover:border-accent/40 whitespace-nowrap"
          >
            {tpl.length > 28 ? tpl.slice(0, 28) + "…" : tpl}
          </button>
          );
        })}
      </div>
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.05] backdrop-blur-md border-t border-subtle shrink-0">
          <Reply size={12} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0 text-[11px] text-muted truncate">
            {replyTo.message || (replyTo.image_path ? t("sup.image") : replyTo.voice_path ? t("sup.voice") : "")}
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 p-1 rounded hover:bg-white/10 text-muted">
            <X size={12} />
          </button>
        </div>
      )}
      {voiceRecorder.recording ? (
        <div className="flex items-center gap-2.5 px-3 py-2 shrink-0 bg-white/[0.04] backdrop-blur-md border-t border-subtle">
          <span className="w-2 h-2 rounded-full bg-[#FF6B85] animate-pulse shrink-0" />
          <span className="text-[12px] text-white font-mono flex-1">{formatDuration(voiceRecorder.durationSeconds)}</span>
          <button onClick={voiceRecorder.cancel} className="p-1.5 rounded-lg bg-white/5 text-muted" aria-label={t("sup.cancelRec")}>
            <Trash2 size={13} />
          </button>
          <button onClick={stopAndSendVoice} disabled={sending} className="p-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim" aria-label={t("sup.send")}>
            <Check size={13} />
          </button>
        </div>
      ) : (
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0 bg-white/[0.04] backdrop-blur-md border-t border-subtle">
        <button onClick={voiceRecorder.start} disabled={sending} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.06] backdrop-blur-md border border-subtle hover:bg-white/10 disabled:opacity-50" aria-label={t("sup.voiceMsg")}>
          <Mic size={13} className="text-muted" />
        </button>
        <input
          className="flex-1 min-w-0 bg-white/[0.06] backdrop-blur-md border border-subtle rounded-lg py-2 px-3 text-[12.5px] outline-none focus:border-accent"
          placeholder={t("sup.phReply")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reply()}
        />
        <button onClick={reply} disabled={sending || !text.trim()} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-accent to-accent-dim disabled:opacity-50">
          <Send size={13} />
        </button>
      </div>
      )}
      </div>
      {confirmDialog}
    </div>
  );
}

// active=false — tab yashirin (boshqa tab yoki jamoa chati ochiq): mount
// holatida qoladi, lekin fonda so'rov yubormaydi.
export function SupportTab({ active = true }: { active?: boolean } = {}) {
  const { t } = useLocale();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [activeCustomer, setActiveCustomer] = useState<SupportThread | null>(null);
  // Brauzer/telefon orqaga tugmasi: ochiq chatni yopadi (ro'yxatga qaytadi).
  useHistoryNav(
    activeCustomer ? "chat-open" : "list",
    !activeCustomer,
    () => { setActiveCustomer(null); }
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  // 1b: ro'yxat THREAD jadvalidan (0105: last_message_at/preview/kind,
  // first_unanswered_at — trigger to'ldiradi). Avval global 300 xabarlik
  // oynadan qurilardi: faol mijozlar ko'payganda eski suhbatlar tushib qolardi.
  // 0105 qo'yilmagan bo'lsa (ustun yo'q) false -> eski usul (loadThreadsLegacy).
  const loadThreadsFromTable = async (): Promise<boolean> => {
    const cols =
      "customer_id, is_archived, claimed_by, last_message_at, last_message_preview, last_message_kind, first_unanswered_at, customers(phone, full_name), profiles!claimed_by(display_name, full_name)";
    const [act, arc] = await Promise.all([
      supabase
        .from("telegram_support_threads")
        .select(cols)
        .eq("is_archived", false)
        .not("last_message_at", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(ACTIVE_THREADS_LIMIT),
      supabase
        .from("telegram_support_threads")
        .select(cols)
        .eq("is_archived", true)
        .not("last_message_at", "is", null)
        .order("last_message_at", { ascending: false })
        .limit(ARCHIVED_THREADS_LIMIT),
    ]);
    if (act.error || arc.error) return false;
    const toThread = (r: any): SupportThread => ({
      customer_id: r.customer_id,
      phone: r.customers?.phone ?? "—",
      full_name: r.customers?.full_name ?? null,
      last_message: r.last_message_preview ?? null,
      last_image: r.last_message_kind === "image",
      last_at: r.last_message_at,
      claimed_by: r.claimed_by ?? null,
      claimed_by_name: r.profiles?.display_name || r.profiles?.full_name || null,
      unanswered_since: r.first_unanswered_at ?? null,
    });
    const activeRows = ((act.data as any[]) ?? []).map(toThread);
    const archivedRows = ((arc.data as any[]) ?? []).map(toThread);
    setThreads([...activeRows, ...archivedRows]);
    setArchivedIds(new Set(archivedRows.map((r) => r.customer_id)));
    return true;
  };

  const loadThreads = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const ok = await loadThreadsFromTable();
    if (!ok) await loadThreadsLegacy();
    if (isInitial) setLoading(false);
  };

  // Eski usul (0105 qo'yilgunga qadar zaxira): global 300 xabarlik oyna.
  const loadThreadsLegacy = async () => {
    // sender + is_system (0104) — "javobsiz" hisobi uchun. is_system ustuni
    // hali yo'q bo'lsa (0104 qo'yilmagan) ustunsiz qayta so'raladi.
    const loadMsgs = (cols: string) =>
      supabase
        .from("telegram_support_messages")
        .select(cols)
        .order("created_at", { ascending: false })
        .limit(300);
    const MSG_COLS = "customer_id, sender, message, image_path, created_at, customers(phone, full_name)";
    const [msgRes, { data: threadRows }] = await Promise.all([
      loadMsgs(`${MSG_COLS}, is_system`),
      supabase.from("telegram_support_threads").select("customer_id, is_archived, claimed_by, profiles!claimed_by(display_name, full_name)"),
    ]);
    let data: any[] | null = msgRes.data as any[] | null;
    if (msgRes.error) data = ((await loadMsgs(MSG_COLS)).data as any[] | null) ?? null;
    const threadInfo = new Map((threadRows ?? []).map((r: any) => [r.customer_id, r]));
    const grouped = new Map<string, SupportThread>();
    // 2.2: har mijoz uchun xabarlar yangidan eskiga ko'riladi; birinchi
    // HAQIQIY operator javobigacha uchragan eng eski mijoz xabari =
    // "javobsiz qachondan". Tizim xabarlari (is_system) javob hisoblanmaydi.
    const answered = new Set<string>();
    // Ro'yxat ko'rinishi oxirgi HAQIQIY (tizim bo'lmagan) xabarni ko'rsatadi —
    // salomlashuv kabi avto-xabar mijoz matnini yashirmasin.
    const previewed = new Set<string>();
    for (const row of (data as any[]) ?? []) {
      const existing = grouped.get(row.customer_id);
      if (existing) {
        if (!previewed.has(row.customer_id) && !row.is_system) {
          existing.last_message = row.message;
          existing.last_image = !!row.image_path;
          previewed.add(row.customer_id);
        }
        if (!answered.has(row.customer_id)) {
          if (row.sender === "customer") existing.unanswered_since = row.created_at;
          else if (row.sender === "operator" && !row.is_system) answered.add(row.customer_id);
        }
        continue;
      }
      if (row.sender === "operator" && !row.is_system) answered.add(row.customer_id);
      if (!row.is_system) previewed.add(row.customer_id);
      {
        const info = threadInfo.get(row.customer_id);
        grouped.set(row.customer_id, {
          customer_id: row.customer_id,
          phone: row.customers?.phone ?? "—",
          full_name: row.customers?.full_name ?? null,
          last_message: row.message,
          last_image: !!row.image_path,
          last_at: row.created_at,
          claimed_by: info?.claimed_by ?? null,
          claimed_by_name: info?.profiles?.display_name || info?.profiles?.full_name || null,
          unanswered_since: row.sender === "customer" ? row.created_at : null,
        });
      }
    }
    // Oxirgi xabar bo'yicha (yangi -> eski); "javobsiz" tartibi faqat faol
    // ko'rinishda qo'llanadi (arxiv avvalgidek).
    setThreads(Array.from(grouped.values()));
    setArchivedIds(new Set((threadRows ?? []).filter((r: any) => r.is_archived).map((r: any) => r.customer_id)));
  };

  useEffect(() => {
    loadThreads(true);
  }, []);
  // Ro'yxat polling'i faqat tab faol paytda; qaytganda darhol jim yangilanadi.
  const listPollStartedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (listPollStartedRef.current) loadThreads(false);
    listPollStartedRef.current = true;
    const interval = setInterval(() => loadThreads(false), 6000);
    return () => clearInterval(interval);
  }, [active]);

  const openThread = async (t: SupportThread) => {
    setActiveCustomer(t);
    // Auto-claims an unclaimed thread the moment an operator opens it —
    // same pattern as order claiming — so it's immediately clear who's
    // handling this customer, without requiring an extra tap.
    if (!t.claimed_by) {
      // Server marshruti orqali; band bo'lsa server olmaydi (oldingi xulq).
      // Avto-olish best-effort — xato bo'lsa ro'yxat yangilanadi, xolos.
      try {
        await fetch("/api/admin/telegram-orders/support-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: t.customer_id }),
        });
      } catch {
        /* best-effort */
      }
      loadThreads(false);
    }
  };

  if (activeCustomer) {
    return (
      <SupportThreadView
        thread={activeCustomer}
        currentUserId={currentUserId}
        onBack={() => { setActiveCustomer(null); loadThreads(false); }}
        onArchived={() => { setActiveCustomer(null); loadThreads(false); }}
        active={active}
      />
    );
  }

  // Birinchi yuklash: maydon bo'sh qolmasin — yuklangan ko'rinishga yaqin
  // balandlikdagi barqaror skelet (qidiruv + filtrlar + 4 qator).
  if (loading) {
    return (
      <div aria-busy="true" aria-label={t("sup.loading")}>
        <div className="w-full h-[38px] mb-3 rounded-lg bg-white/[0.04] border border-subtle animate-pulse" />
        <div className="flex gap-2 mb-4">
          {[64, 64, 92].map((w, i) => (
            <div key={i} className="h-[30px] rounded-lg bg-white/[0.04] border border-subtle animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 rounded-xl bg-white/[0.03] border border-subtle">
              <div className="h-[13px] w-40 rounded bg-white/10 animate-pulse mb-2" />
              <div className="h-[12px] w-3/4 rounded bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const baseThreads = threads
    .filter((th) => archivedIds.has(th.customer_id) === showArchived)
    .filter((th) => !onlyMine || th.claimed_by === currentUserId);
  // 2.2: faol ko'rinishda eng uzoq javobsiz turgan suhbat tepada.
  const visibleThreads = showArchived
    ? baseThreads
    : [
        ...baseThreads
          .filter((th) => th.unanswered_since)
          .sort((a, b) => new Date(a.unanswered_since!).getTime() - new Date(b.unanswered_since!).getTime()),
        ...baseThreads.filter((th) => !th.unanswered_since),
      ];
  const filteredThreads = search.trim()
    ? visibleThreads.filter((th) => `${th.full_name ?? ""} ${th.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
    : visibleThreads;

  return (
    <div>
      <input
        className="w-full mb-3 bg-white/[0.06] backdrop-blur-md border border-subtle rounded-lg py-2 px-3.5 text-[13px] outline-none focus:border-accent"
        placeholder={t("sup.phSearch")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${!showArchived ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}
        >
          {t("sup.fActive")}
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${showArchived ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}
        >
          {t("sup.fArchive")}
        </button>
        <button
          onClick={() => setOnlyMine((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${onlyMine ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}
        >
          {t("sup.fOnlyMine")}
        </button>
      </div>

      {filteredThreads.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] backdrop-blur-md border border-subtle p-8 text-center text-[13px] text-muted">
          {search ? t("sup.notFound") : showArchived ? t("sup.archiveEmpty") : t("sup.noThreads")}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredThreads.map((th) => {
            const waitingSince = !showArchived ? th.unanswered_since : null;
            const waitMs = waitingSince ? Date.now() - new Date(waitingSince).getTime() : 0;
            const overdue = waitingSince ? waitMs > SUPPORT_WAIT_ALERT_MIN * 60000 : false;
            return (
            <button
              key={th.customer_id}
              onClick={() => openThread(th)}
              className={`w-full text-left p-3.5 rounded-xl bg-white/[0.03] backdrop-blur-md border hover:bg-white/[0.05] ${
                overdue ? "border-[#FF6B85]/50 hover:border-[#FF6B85]/70" : "border-subtle hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="text-[13px] font-semibold truncate">{th.full_name || formatPhone(th.phone)}</div>
                {th.claimed_by && (
                  <span className={`shrink-0 text-[9.5px] px-2 py-0.5 rounded-full border ${
                    th.claimed_by === currentUserId ? "bg-accent/15 border-accent/40 text-accent" : "bg-white/5 border-subtle text-muted"
                  }`}>
                    🔵 {th.claimed_by === currentUserId ? t("sup.youAnswer") : t("sup.isAnswering", { name: th.claimed_by_name || t("sup.operator") })}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted truncate mt-0.5">{th.last_image ? t("sup.image") : th.last_message}</div>
              {waitingSince && (
                <div className={`mt-1.5 inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full ${
                  overdue ? "bg-[#FF6B85]/15 text-[#FF6B85]" : "bg-[#F4C76A]/10 text-[#F4C76A]"
                }`}>
                  ⏱ {t("sup.waitingFor", { t: formatWait(t, waitingSince, Date.now()) })}
                </div>
              )}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

