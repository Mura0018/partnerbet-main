"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

type SupportThread = {
  customer_id: string; phone: string; full_name: string | null; last_message: string | null; last_image: boolean; last_at: string;
  claimed_by: string | null; claimed_by_name: string | null;
};
type SupportMsg = {
  id: string; sender: "customer" | "operator"; message: string | null; image_path: string | null;
  file_name: string | null; voice_path: string | null; voice_duration_seconds: number | null; reply_to_id: string | null; created_at: string;
};

const REPLY_TEMPLATES = [
  "Assalomu alaykum! Sizga qanday yordam bera olamiz?",
  "So'rovingiz ko'rib chiqilmoqda, biroz kuting.",
  "Iltimos, to'lov chekining aniqroq skrinshotini yuboring.",
  "Ma'lumotlaringiz uchun rahmat, tekshirib ko'ramiz.",
  "Muammo hal qilindi. Yana savollaringiz bo'lsa, murojaat qiling.",
  "Kechirasiz, kutish uchun rahmat — operator tez orada javob beradi.",
];

function SupportImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/telegram-orders/support-image-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => setUrl(data.url ?? null))
      .catch(() => setUrl(null));
  }, [path]);

  if (!url) return <p className="text-[11px] text-muted">Rasm yuklanmoqda…</p>;

  return (
    <>
      <img src={url} alt="Mijoz yuborgan rasm" onClick={() => setExpanded(true)} className="max-w-[180px] rounded-lg cursor-zoom-in" />
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
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/telegram-orders/support-image-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => setUrl(data.url ?? null))
      .catch(() => setUrl(null));
  }, [path]);

  if (!url) return <p className="text-[11px] text-muted">Yuklanmoqda…</p>;
  return <audio controls src={url} className="max-w-[220px] h-9" />;
}

function SupportThreadView({ thread, currentUserId, onBack, onArchived }: { thread: SupportThread; currentUserId: string | null; onBack: () => void; onArchived: () => void }) {
  const [msgs, setMsgs] = useState<SupportMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [claimedBy, setClaimedBy] = useState(thread.claimed_by);
  const [claimedByName, setClaimedByName] = useState(thread.claimed_by_name);
  const [replyTo, setReplyTo] = useState<SupportMsg | null>(null);
  const [myTheme, setMyTheme] = useState<string>("blue");
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const voiceRecorder = useVoiceRecorder();
  const supabase = createClient();

  const loadThread = async () => {
    const { data } = await supabase
      .from("telegram_support_messages")
      .select("id, sender, message, image_path, file_name, voice_path, voice_duration_seconds, reply_to_id, created_at")
      .eq("customer_id", thread.customer_id)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data as any[]) ?? []);
  };

  useEffect(() => {
    loadThread();
    const interval = setInterval(loadThread, 4000);
    return () => clearInterval(interval);
  }, [thread.customer_id]);

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

  const deleteMessage = async (id: string) => {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return;
    await fetch("/api/admin/telegram-orders/support-delete-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id }),
    });
    await loadThread();
  };

  const messageById = (id: string | null) => (id ? msgs.find((m) => m.id === id) ?? null : null);

  const stopAndSendVoice = async () => {
    const recorded = await voiceRecorder.stop();
    if (!recorded || recorded.durationSeconds < 1) return;
    setSending(true);
    try {
      const audioBase64 = await blobToBase64(recorded.blob);
      await fetch("/api/admin/telegram-orders/support-reply-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id, audioBase64, mimeType: recorded.mimeType, durationSeconds: recorded.durationSeconds }),
      });
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

  const endChat = async () => {
    if (!confirm("Suhbatni yakunlashni tasdiqlaysizmi? Mijozga tasdiqlash so'rovi yuboriladi.")) return;
    setArchiving(true);
    try {
      const res = await fetch("/api/admin/telegram-orders/support-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: thread.customer_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Xato: " + JSON.stringify(data));
      } else {
        alert("Yakunlash so'rovi yuborildi!");
      }
    } finally {
      setArchiving(false);
    }
  };

  const takeOver = async () => {
    await supabase.from("telegram_support_threads").upsert(
      { customer_id: thread.customer_id, claimed_by: currentUserId, claimed_at: new Date().toISOString() },
      { onConflict: "customer_id" }
    );
    const { data } = await supabase.from("profiles").select("display_name, full_name").eq("id", currentUserId).maybeSingle();
    setClaimedBy(currentUserId);
    setClaimedByName(data?.display_name || data?.full_name || null);
  };

  return (
    <div className="fixed inset-0 z-40 bg-bg flex flex-col">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8 shrink-0">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10" aria-label="Orqaga">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold truncate">{thread.full_name || thread.phone}</h1>
        </div>
        <button
          onClick={endChat}
          disabled={archiving}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/25 text-accent hover:bg-accent/25 disabled:opacity-50"
        >
          Yakunlash
        </button>
        <button
          onClick={archive}
          disabled={archiving}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white disabled:opacity-50"
        >
          {archiving ? "…" : "Arxivlash"}
        </button>
      </div>

      {claimedBy && claimedBy !== currentUserId ? (
        <div className="flex items-center justify-between gap-2 px-5 py-2 bg-[#F4C76A]/10 border-b border-[#F4C76A]/20 shrink-0">
          <span className="text-[11px] text-[#F4C76A]">🔵 {claimedByName || "Boshqa operator"} bu mijozga javob bermoqda</span>
          <button onClick={takeOver} className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-white/10 text-white">O'zimga olish</button>
        </div>
      ) : claimedBy === currentUserId ? (
        <div className="px-5 py-1.5 bg-accent/10 border-b border-accent/15 shrink-0">
          <span className="text-[10.5px] text-accent">🔵 Siz bu mijozga javob berayapsiz</span>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        {msgs.length === 0 && <p className="text-[12px] text-muted text-center mt-8">Hozircha xabar yo'q.</p>}
        {msgs.map((m) => {
          const quoted = messageById(m.reply_to_id);
          const quotedLabel = quoted ? (quoted.sender === "operator" ? "Operator" : "Mijoz") : null;
          return (
          <div key={m.id} className={`flex flex-col ${m.sender === "operator" ? "items-end" : "items-start"}`}>
            <span className="text-[9px] text-[#5b6f85] mb-0.5 px-1">{m.sender === "operator" ? "Siz (operator)" : "Mijoz"}</span>
            <div
              className={`max-w-[78%] rounded-xl px-3 py-2 text-[12.5px] leading-snug ${m.sender === "operator" ? "text-white" : "bg-white/[0.08]"}`}
              style={m.sender === "operator" ? { background: chatThemeGradient(myTheme) } : undefined}
            >
              {quoted && (
                <div className={`mb-1.5 pl-2 border-l-2 text-[10.5px] opacity-70 truncate max-w-[220px] ${m.sender === "operator" ? "border-white/50" : "border-accent/50"}`}>
                  <span className="font-semibold">{quotedLabel}</span>{" "}
                  {quoted.message || (quoted.image_path ? "📷 Rasm" : quoted.voice_path ? "🎤 Ovozli xabar" : "")}
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
              <div className="text-[8px] text-white/40 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className={`flex items-center gap-2.5 mt-0.5 px-1 ${m.sender === "operator" ? "flex-row-reverse" : ""}`}>
              <button onClick={() => setReplyTo(m)} className="text-[9px] text-[#5b6f85] hover:text-white flex items-center gap-0.5">
                <Reply size={9} /> Javob
              </button>
              {m.sender === "operator" && (
                <button onClick={() => deleteMessage(m.id)} className="text-[9px] text-[#5b6f85] hover:text-[#FF6B85] flex items-center gap-0.5">
                  <Trash2 size={9} /> O'chirish
                </button>
              )}
            </div>
          </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto shrink-0">
        {REPLY_TEMPLATES.map((tpl, i) => (
          <button
            key={i}
            onClick={() => setText(tpl)}
            className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-muted hover:text-white hover:border-accent/40 whitespace-nowrap"
          >
            {tpl.length > 28 ? tpl.slice(0, 28) + "…" : tpl}
          </button>
        ))}
      </div>
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/8 bg-white/[0.03] shrink-0">
          <Reply size={12} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0 text-[11px] text-muted truncate">
            {replyTo.message || (replyTo.image_path ? "📷 Rasm" : replyTo.voice_path ? "🎤 Ovozli xabar" : "")}
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 p-1 rounded hover:bg-white/10 text-muted">
            <X size={12} />
          </button>
        </div>
      )}
      {voiceRecorder.recording ? (
        <div className="flex items-center gap-2.5 px-3 py-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#FF6B85] animate-pulse shrink-0" />
          <span className="text-[12px] text-white font-mono flex-1">{formatDuration(voiceRecorder.durationSeconds)}</span>
          <button onClick={voiceRecorder.cancel} className="p-1.5 rounded-lg bg-white/5 text-muted" aria-label="Bekor qilish">
            <Trash2 size={13} />
          </button>
          <button onClick={stopAndSendVoice} disabled={sending} className="p-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim" aria-label="Yuborish">
            <Check size={13} />
          </button>
        </div>
      ) : (
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
        <button onClick={voiceRecorder.start} disabled={sending} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50" aria-label="Ovozli xabar">
          <Mic size={13} className="text-muted" />
        </button>
        <input
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[12.5px] outline-none focus:border-accent"
          placeholder="Javob yozing..."
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
  );
}

export function SupportTab() {
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

  const loadThreads = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const [{ data }, { data: threadRows }] = await Promise.all([
      supabase
        .from("telegram_support_messages")
        .select("customer_id, message, image_path, created_at, customers(phone, full_name)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("telegram_support_threads").select("customer_id, is_archived, claimed_by, profiles!claimed_by(display_name, full_name)"),
    ]);
    const threadInfo = new Map((threadRows ?? []).map((r: any) => [r.customer_id, r]));
    const grouped = new Map<string, SupportThread>();
    for (const row of (data as any[]) ?? []) {
      if (!grouped.has(row.customer_id)) {
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
        });
      }
    }
    setThreads(Array.from(grouped.values()));
    setArchivedIds(new Set((threadRows ?? []).filter((r: any) => r.is_archived).map((r: any) => r.customer_id)));
    if (isInitial) setLoading(false);
  };

  useEffect(() => {
    loadThreads(true);
    const interval = setInterval(() => loadThreads(false), 6000);
    return () => clearInterval(interval);
  }, []);

  const openThread = async (t: SupportThread) => {
    setActiveCustomer(t);
    // Auto-claims an unclaimed thread the moment an operator opens it —
    // same pattern as order claiming — so it's immediately clear who's
    // handling this customer, without requiring an extra tap.
    if (!t.claimed_by) {
      await supabase.from("telegram_support_threads").upsert(
        { customer_id: t.customer_id, claimed_by: currentUserId, claimed_at: new Date().toISOString() },
        { onConflict: "customer_id" }
      );
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
      />
    );
  }

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda...</p>;

  const visibleThreads = threads
    .filter((t) => archivedIds.has(t.customer_id) === showArchived)
    .filter((t) => !onlyMine || t.claimed_by === currentUserId);
  const filteredThreads = search.trim()
    ? visibleThreads.filter((t) => `${t.full_name ?? ""} ${t.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
    : visibleThreads;

  return (
    <div>
      <input
        className="w-full mb-3 bg-white/5 border border-white/10 rounded-lg py-2 px-3.5 text-[13px] outline-none focus:border-accent"
        placeholder="Mijozni qidirish: ism yoki telefon..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowArchived(false)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${!showArchived ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
        >
          Faol
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${showArchived ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
        >
          Arxiv
        </button>
        <button
          onClick={() => setOnlyMine((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${onlyMine ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
        >
          Faqat mening
        </button>
      </div>

      {filteredThreads.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          {search ? "Hech narsa topilmadi." : showArchived ? "Arxiv bo'sh." : "Hozircha murojaat yo'q."}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredThreads.map((t) => (
            <button
              key={t.customer_id}
              onClick={() => openThread(t)}
              className="w-full text-left p-3.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="text-[13px] font-semibold truncate">{t.full_name || t.phone}</div>
                {t.claimed_by && (
                  <span className={`shrink-0 text-[9.5px] px-2 py-0.5 rounded-full border ${
                    t.claimed_by === currentUserId ? "bg-accent/15 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-muted"
                  }`}>
                    🔵 {t.claimed_by === currentUserId ? "Siz javob berasiz" : `${t.claimed_by_name || "Operator"} javob bermoqda`}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted truncate mt-0.5">{t.last_image ? "📷 Rasm" : t.last_message}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

