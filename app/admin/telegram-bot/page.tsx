"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#F4C76A",
  admin: "#3D7FFF",
  operator: "#4ADE80",
};

const REJECT_REASON_TEMPLATES = [
  "To'lov cheki noaniq/mos emas",
  "Hisob ID noto'g'ri yoki topilmadi",
  "Summasi to'lovga mos kelmayapti",
  "Pul yechish kodi noto'g'ri",
  "Takroriy buyurtma",
];

type ChatMessage = {
  id: string;
  message: string | null;
  image_path: string | null;
  file_name: string | null;
  voice_path: string | null;
  voice_duration_seconds: number | null;
  created_at: string;
  sender_id: string;
  reply_to_id: string | null;
  is_system: boolean;
  profiles: { full_name: string | null; display_name: string | null; avatar_url: string | null; is_online: boolean | null; roles: { key: string } | null } | null;
};

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [myTheme, setMyTheme] = useState<string>("blue");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceRecorder = useVoiceRecorder();
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("team_chat_messages")
      .select("id, message, image_path, file_name, voice_path, voice_duration_seconds, created_at, sender_id, reply_to_id, is_system, profiles(full_name, display_name, avatar_url, is_online, roles(key))")
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data as any[]) ?? []);
    await markSeenAndClearSystemMessages((data as any[]) ?? []);
  };

  // System notices (operator status changes) are meant to be transient —
  // once every active staff member has opened the chat and seen one, it
  // clears itself so the thread doesn't fill up with stale "X went
  // offline" notes. Marks the current viewer as having seen each system
  // message present, then — if that brings the seen-count up to the full
  // active-staff count — deletes it (any staff member's RLS lets them
  // clear a system message, not just whoever posted it).
  const markSeenAndClearSystemMessages = async (rows: ChatMessage[]) => {
    const systemMsgs = rows.filter((m) => m.is_system);
    if (systemMsgs.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const m of systemMsgs) {
      await supabase.from("team_chat_message_reads").upsert(
        { message_id: m.id, user_id: user.id },
        { onConflict: "message_id,user_id" }
      );
    }

    const { count: activeStaffCount } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (!activeStaffCount) return;

    for (const m of systemMsgs) {
      const { count: seenCount } = await supabase.from("team_chat_message_reads").select("user_id", { count: "exact", head: true }).eq("message_id", m.id);
      if ((seenCount ?? 0) >= activeStaffCount) {
        await supabase.from("team_chat_messages").delete().eq("id", m.id);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      if (user) {
        const { data } = await supabase.from("profiles").select("chat_theme").eq("id", user.id).maybeSingle();
        if (data?.chat_theme) setMyTheme(data.chat_theme);
      }
    });
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  const changeMyTheme = async (next: string) => {
    setMyTheme(next);
    setShowThemePicker(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ chat_theme: next }).eq("id", user.id);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("team_chat_messages").insert({ sender_id: user.id, message: text.trim(), reply_to_id: replyTo?.id ?? null });
      if (error) {
        alert("Xabar yuborilmadi: " + error.message);
        setSending(false);
        return;
      }
      setText("");
      setReplyTo(null);
      await load();
    }
    setSending(false);
  };

  const removeMessage = async (id: string) => {
    if (!confirm("Xabarni o'chirishni tasdiqlaysizmi?")) return;
    await supabase.from("team_chat_messages").delete().eq("id", id);
    await load();
  };

  const messageById = (id: string | null) => (id ? messages.find((m) => m.id === id) ?? null : null);

  const sendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("team-chat-attachments").upload(path, file, { upsert: false });
      if (!error) {
        await supabase.from("team_chat_messages").insert({ sender_id: user.id, image_path: path, file_name: file.name, reply_to_id: replyTo?.id ?? null });
        setReplyTo(null);
        await load();
      }
    } finally {
      setSending(false);
    }
  };

  const stopAndSendVoice = async () => {
    const recorded = await voiceRecorder.stop();
    if (!recorded || recorded.durationSeconds < 1) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSending(true);
    try {
      const ext = recorded.mimeType.includes("mp4") ? "m4a" : recorded.mimeType.includes("ogg") ? "ogg" : "webm";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("team-chat-attachments").upload(path, recorded.blob, { upsert: false, contentType: recorded.mimeType });
      if (!error) {
        await supabase.from("team_chat_messages").insert({ sender_id: user.id, voice_path: path, voice_duration_seconds: recorded.durationSeconds, reply_to_id: replyTo?.id ?? null });
        setReplyTo(null);
        await load();
      }
    } finally {
      setSending(false);
    }
  };

  const filtered = search.trim()
    ? messages.filter((m) => `${m.message ?? ""} ${m.file_name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    : messages;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] flex flex-col h-full min-w-0">
      <div className="flex items-center gap-2 p-2.5 border-b border-white/8">
        {showSearch ? (
          <input
            autoFocus
            className="flex-1 bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-[12px] outline-none focus:border-accent"
            placeholder="Xabar yoki fayl nomini qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/15"
              style={{ background: "linear-gradient(135deg, rgba(61,127,255,0.25), rgba(61,127,255,0.08))" }}
            >
              <Lock size={12} className="text-[#7db8ff]" />
            </span>
            <span className="text-[13px] font-bold"><span className="text-white">Maxfiy</span> <span className="text-accent">chat</span></span>
          </div>
        )}
        <button
          onClick={() => { setShowSearch((v) => !v); setSearch(""); }}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted shrink-0"
          aria-label="Qidirish"
        >
          <Search size={15} />
        </button>
        <button
          onClick={() => setShowThemePicker((v) => !v)}
          className="p-1.5 rounded-md hover:bg-white/10 text-muted shrink-0"
          aria-label="Mavzu"
        >
          <Palette size={15} />
        </button>
      </div>
      {showThemePicker && (
        <div className="px-3 py-2.5 border-b border-white/8">
          <ThemePicker value={myTheme} onChange={changeMyTheme} />
        </div>
      )}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2 min-w-0 min-h-0"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      >
        {filtered.length === 0 && (
          <p className="text-[12px] text-muted text-center mt-8">
            {search ? "Hech narsa topilmadi." : "Hozircha xabar yo'q. Birinchi bo'lib yozing."}
          </p>
        )}
        {filtered.map((m) => {
          if (m.is_system) {
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span className="text-[10.5px] text-[#93a5ba] bg-white/[0.05] border border-white/8 rounded-full px-3 py-1">
                  {m.message}
                </span>
              </div>
            );
          }
          const roleKey = m.profiles?.roles?.key ?? "user";
          const color = ROLE_COLOR[roleKey] ?? "#5b6f85";
          const name = m.profiles?.display_name || m.profiles?.full_name || "?";
          const isMe = m.sender_id === currentUserId;
          const imageUrl = m.image_path ? supabase.storage.from("team-chat-attachments").getPublicUrl(m.image_path).data.publicUrl : null;
          const voiceUrl = m.voice_path ? supabase.storage.from("team-chat-attachments").getPublicUrl(m.voice_path).data.publicUrl : null;
          const quoted = messageById(m.reply_to_id);
          const quotedName = quoted ? (quoted.sender_id === currentUserId ? "Siz" : quoted.profiles?.display_name || quoted.profiles?.full_name || "?") : null;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="relative shrink-0">
                {m.profiles?.avatar_url ? (
                  <img src={m.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border" style={{ borderColor: color }} />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border"
                    style={{ borderColor: color, color, background: `${color}1a` }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a1224] ${m.profiles?.is_online ? "bg-[#4ADE80]" : "bg-[#5b6f85]"}`}
                  title={m.profiles?.is_online ? "Faol" : "Band"}
                />
              </div>
              <div className={`min-w-0 max-w-[78%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`flex items-baseline gap-1.5 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className="text-[10px] font-bold" style={{ color }}>{isMe ? "Siz" : name}</span>
                  <span className="text-[9px] text-[#5b6f85]">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div
                  className={`rounded-xl px-3 py-2 text-[12.5px] leading-snug break-words ${isMe ? "text-white" : "bg-white/[0.08] text-white/90"}`}
                  style={isMe ? { background: chatThemeGradient(myTheme) } : undefined}
                >
                  {quoted && (
                    <div className={`mb-1.5 pl-2 border-l-2 text-[10.5px] opacity-70 truncate max-w-[220px] ${isMe ? "border-white/50" : "border-accent/50"}`}>
                      <span className="font-semibold">{quotedName}</span>{" "}
                      {quoted.message || (quoted.image_path ? "📷 Rasm" : quoted.voice_path ? "🎤 Ovozli xabar" : "")}
                    </div>
                  )}
                  {voiceUrl ? (
                    <audio controls src={voiceUrl} className="max-w-[200px] h-8" />
                  ) : imageUrl ? (
                    <div>
                      <img src={imageUrl} alt="" className="max-w-[180px] rounded-lg" />
                      {m.file_name && <div className="text-[9px] text-white/50 mt-1 truncate max-w-[180px]">{m.file_name}</div>}
                    </div>
                  ) : (
                    m.message
                  )}
                </div>
                <div className={`flex items-center gap-2.5 mt-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  <button onClick={() => setReplyTo(m)} className="text-[9px] text-[#5b6f85] hover:text-white flex items-center gap-0.5">
                    <Reply size={9} /> Javob
                  </button>
                  {isMe && (
                    <button onClick={() => removeMessage(m.id)} className="text-[9px] text-[#5b6f85] hover:text-[#FF6B85] flex items-center gap-0.5">
                      <Trash2 size={9} /> O'chirish
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/8 bg-white/[0.03]">
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
        <div className="flex items-center gap-2.5 px-3 py-2 border-t border-white/8">
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
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/8">
        <label className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
          <Paperclip size={13} className="text-muted" />
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={sendImage} disabled={sending} />
        </label>
        <button onClick={voiceRecorder.start} disabled={sending} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50" aria-label="Ovozli xabar">
          <Mic size={13} className="text-muted" />
        </button>
        <input
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[12.5px] outline-none focus:border-accent"
          placeholder="Xabar yozing..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={sending || !text.trim()} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-accent to-accent-dim disabled:opacity-50">
          <Send size={13} />
        </button>
      </div>
      )}
    </div>
  );
}

type OperatorRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  telegram_region: string | null;
  is_online: boolean;
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

function OperatorsTab() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [regionDrafts, setRegionDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, is_active, telegram_region, is_online, roles!inner(key)")
      .eq("roles.key", "operator")
      .order("full_name");
    setOperators((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveRegion = async (id: string) => {
    const region = regionDrafts[id];
    if (region === undefined) return;
    await supabase.from("profiles").update({ telegram_region: region }).eq("id", id);
    load();
  };

  const toggleActive = async (op: OperatorRow) => {
    await supabase.from("profiles").update({ is_active: !op.is_active }).eq("id", op.id);
    load();
  };

  return (
    <div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-5 text-[12px] text-muted leading-relaxed">
        Yangi operator qo'shish uchun avval <a href="/admin/users" className="text-accent">Foydalanuvchilar</a> bo'limida
        shaxsning rolini <span className="text-white font-medium">Operator</span> qilib belgilang — u shu ro'yxatda
        avtomatik paydo bo'ladi, so'ng mintaqasini shu yerda kiriting.
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : operators.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Hozircha Operator rolidagi foydalanuvchi yo'q.
        </div>
      ) : (
        <div className="space-y-3">
          {operators.map((op) => (
            <div key={op.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${op.is_online ? "bg-[#4ADE80]" : "bg-[#5b6f85]"}`} />
                  {op.full_name || "(ism kiritilmagan)"}
                </div>
                <div className="text-[11px] mt-0.5 text-muted">
                  Ish holati: <span className={op.is_online ? "text-[#4ADE80]" : "text-[#F4C76A]"}>{op.is_online ? "Faol" : "Band"}</span>
                  {" · "}Hisob: <span className={op.is_active ? "text-[#4ADE80]" : "text-[#5b6f85]"}>{op.is_active ? "Yoqilgan" : "O'chirilgan"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-muted shrink-0" />
                <input
                  className={inputCls}
                  placeholder="Mintaqa (masalan: Toshkent)"
                  defaultValue={op.telegram_region ?? ""}
                  onChange={(e) => setRegionDrafts((prev) => ({ ...prev, [op.id]: e.target.value }))}
                />
                <button onClick={() => saveRegion(op.id)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  Saqlash
                </button>
                <button onClick={() => toggleActive(op)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  {op.is_active ? "O'chirish" : "Yoqish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Order = {
  id: string;
  type: "topup" | "withdraw";
  platform: string;
  account_id: string;
  amount: number;
  payment_method: string;
  withdraw_code: string | null;
  payout_details: string | null;
  recipient_name: string | null;
  receipt_path: string | null;
  status: "pending" | "completed" | "rejected";
  operator_note: string | null;
  operator_id: string | null;
  claimed_by: string | null;
  payment_operator_id: string | null;
  received_account_number: string | null;
  received_holder_name: string | null;
  player_name: string | null;
  auto_processed: boolean;
  created_at: string;
  customers: { phone: string; full_name: string | null } | null;
};

const ORDER_STATUS_FILTERS: { id: "pending" | "completed" | "rejected" | "all"; label: string }[] = [
  { id: "pending", label: "Kutilmoqda" },
  { id: "completed", label: "Bajarilgan" },
  { id: "rejected", label: "Rad etilgan" },
  { id: "all", label: "Barchasi" },
];

function ReceiptViewer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/telegram-orders/receipt-url?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => setUrl(data.url ?? null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) return <p className="text-[12px] text-muted">Chek yuklanmoqda…</p>;
  if (!url) return <p className="text-[12px] text-[#FF6B85]">Chekni yuklab bo'lmadi.</p>;

  return (
    <>
      <img
        src={url}
        alt="To'lov cheki"
        onClick={() => setExpanded(true)}
        className="w-full max-h-56 object-contain rounded-lg border border-white/10 cursor-zoom-in bg-black/20"
      />
      {expanded && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-5"
          onClick={() => setExpanded(false)}
        >
          <img src={url} alt="To'lov cheki" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function ResolveModal({ order, operatorNames, onClose, onDone }: { order: Order; operatorNames: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"completed" | "rejected" | null>(null);
  const [apiError, setApiError] = useState("");

  const CASHDESK_ERROR_LABELS: Record<string, string> = {
    not_configured: "Kassa API sozlanmagan — buyurtma faqat qo'lda belgilanadi.",
    network_error: "Kassa API bilan ulanishda xatolik. Qayta urinib ko'ring.",
    request_failed: "Kassa API so'rovi muvaffaqiyatsiz. Qayta urinib ko'ring.",
    signature_error_401: "Kassa API imzosi noto'g'ri (401) — Sozlamalar > API kalitlar'da kassa ma'lumotlarini tekshiring.",
    signature_error_403: "Kassa API ruxsat xatosi (403) — Sozlamalar > API kalitlar'da kassa ma'lumotlarini tekshiring.",
  };

  const resolve = async (status: "completed" | "rejected") => {
    setApiError("");
    setSubmitting(status);
    try {
      const res = await fetch("/api/admin/telegram-orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, status, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "cashdesk_failed") {
          setApiError(CASHDESK_ERROR_LABELS[data.detail] ?? `Kassa API xatosi: ${data.detail}`);
        } else {
          setApiError("Xatolik yuz berdi. Qayta urinib ko'ring.");
        }
        return;
      }
      onDone();
    } finally {
      setSubmitting(null);
    }
  };

  const Row = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[12px] text-muted shrink-0">{label}</span>
      <span className={`text-[13px] text-right ${highlight ? "font-semibold text-white" : ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-[16px]">{order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"}</h2>
          <button onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <div className="text-[22px] font-extrabold mb-4">{Number(order.amount).toLocaleString("ru-RU")} so'm</div>

        {/* Verification checks — the things an operator must actually look at */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5 mb-4">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2.5">Tekshiruvlar</div>

          <div className="flex items-center gap-2 mb-3">
            {order.player_name ? (
              <>
                <CheckCircle2 size={15} className="text-[#4ADE80] shrink-0" />
                <span className="text-[13px]">
                  O'yinchi: <span className="font-semibold text-[#4ADE80]">{order.player_name}</span>
                  <span className="text-[10px] text-[#5b6f85] ml-1">(kassa API orqali tasdiqlangan)</span>
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={15} className="text-[#F4C76A] shrink-0" />
                <span className="text-[13px] text-[#F4C76A]">O'yinchi ismi tekshirilmagan — ID'ni qo'lda tekshiring.</span>
              </>
            )}
          </div>

          {order.type === "topup" && (
            <div className="mb-3 rounded-lg bg-accent/10 border border-accent/25 px-3 py-2.5">
              <div className="text-[11px] text-accent font-semibold mb-1">💳 To'lov qabul qilingan joy</div>
              {order.received_account_number ? (
                <div className="text-[13px]">
                  <span className="font-semibold">{order.received_account_number}</span>
                  {order.received_holder_name && <span className="text-muted"> — {order.received_holder_name}</span>}
                  <div className="text-[11px] text-muted mt-0.5">
                    Operator: <span className="font-semibold text-white">
                      {order.payment_operator_id ? (operatorNames[order.payment_operator_id] ?? "noma'lum") : "noma'lum"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[#F4C76A]">Yozib olinmagan (eski buyurtma) — mijozdan so'rang.</p>
              )}
            </div>
          )}

          {order.type === "topup" && (
            <div>
              <div className="text-[12px] text-muted mb-1.5">To'lov cheki</div>
              {order.receipt_path ? (
                <ReceiptViewer path={order.receipt_path} />
              ) : (
                <p className="text-[12px] text-[#FF6B85]">Mijoz chek yuklamagan.</p>
              )}
            </div>
          )}

          {order.type === "withdraw" && (
            <div className="flex items-center gap-2">
              <UserCheck size={15} className="text-accent shrink-0" />
              <span className="text-[13px]">
                Qabul qiluvchi: <span className="font-semibold">{order.recipient_name || "—"}</span>
              </span>
            </div>
          )}
        </div>

        {/* Order details */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5 mb-4">
          <Row label="Mijoz" value={order.customers?.full_name || order.customers?.phone || "—"} />
          <Row label="Platforma" value={order.platform} />
          <Row label="Hisob ID" value={order.account_id} />
          <Row label="To'lov usuli" value={order.payment_method} />
          {order.withdraw_code && <Row label="Yechish kodi" value={order.withdraw_code} highlight />}
          {order.payout_details && <Row label="Qabul qiluvchi raqam" value={order.payout_details} highlight />}
        </div>

        <div className="flex gap-1.5 mb-2 overflow-x-auto min-w-0">
          {REJECT_REASON_TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setNote(tpl)}
              className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted hover:text-white hover:border-accent/40 whitespace-nowrap"
            >
              {tpl}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent mb-3"
          placeholder="Izoh (ixtiyoriy) — mijozga yuboriladi"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {apiError && (
          <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[12px] px-3 py-2.5 mb-3">
            {apiError}
          </div>
        )}
        <div className="flex gap-2.5">
          <button
            onClick={() => resolve("rejected")}
            disabled={submitting !== null}
            className="flex-1 py-2.5 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] font-semibold text-[13px] disabled:opacity-50"
          >
            {submitting === "rejected" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Rad etish"}
          </button>
          <button
            onClick={() => resolve("completed")}
            disabled={submitting !== null}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50"
          >
            {submitting === "completed" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Bajarildi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CashdeskBalanceBadge() {
  const [state, setState] = useState<{ configured: boolean; balance?: number | null; limit?: number | null } | null>(null);

  useEffect(() => {
    fetch("/api/admin/telegram-orders/balance")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false }));
  }, []);

  if (!state || !state.configured) return null;

  return (
    <div className="mb-4 rounded-lg bg-white/[0.02] border border-white/8 px-3.5 py-2.5 text-[12px] flex items-center gap-4">
      <span className="text-muted">Kassa balansi:</span>
      <span className="font-semibold">{state.balance != null ? Number(state.balance).toLocaleString("ru-RU") : "—"}</span>
      {state.limit != null && (
        <>
          <span className="text-muted">Limit:</span>
          <span className="font-semibold">{Number(state.limit).toLocaleString("ru-RU")}</span>
        </>
      )}
    </div>
  );
}

function LimitsEditor() {
  const [values, setValues] = useState({ max_order_amount: "", daily_customer_limit: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "betcore_pay_limits").maybeSingle();
      const v = (data?.value as any) ?? {};
      setValues({
        max_order_amount: v.max_order_amount != null ? String(v.max_order_amount) : "",
        daily_customer_limit: v.daily_customer_limit != null ? String(v.daily_customer_limit) : "",
      });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("site_settings")
      .update({
        value: { max_order_amount: Number(values.max_order_amount) || 0, daily_customer_limit: Number(values.daily_customer_limit) || 0 },
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "betcore_pay_limits");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return null;

  return (
    <div className="mb-4 rounded-lg bg-white/[0.02] border border-white/8 px-3.5 py-3">
      <div className="text-[11px] text-muted mb-2">Xavfsizlik limitlari (so'mda)</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-[#5b6f85] mb-1">Bitta buyurtma maksimumi</label>
          <input
            type="number"
            className="w-36 bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px]"
            value={values.max_order_amount}
            onChange={(e) => setValues((prev) => ({ ...prev, max_order_amount: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#5b6f85] mb-1">Kunlik mijoz limiti</label>
          <input
            type="number"
            className="w-36 bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px]"
            value={values.daily_customer_limit}
            onChange={(e) => setValues((prev) => ({ ...prev, daily_customer_limit: e.target.value }))}
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold disabled:opacity-60"
        >
          {saving ? "…" : saved ? "Saqlandi ✓" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

function MyStatusToggle() {
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("is_online, display_name, full_name").eq("id", user.id).maybeSingle();
      if (data) setIsOnline(data.is_online ?? true);
      setLoading(false);
    });
  }, []);

  const toggle = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const next = !isOnline;
    const { data: profile } = await supabase.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle();
    const name = profile?.display_name || profile?.full_name || "Operator";

    await supabase.from("profiles").update({ is_online: next }).eq("id", user.id);
    await supabase.from("team_chat_messages").insert({
      sender_id: user.id,
      message: next ? `🟢 ${name} endi faol.` : `🔴 ${name} band holatiga o'tdi.`,
      is_system: true,
    });
    setIsOnline(next);
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className={`mb-4 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3 border ${
      isOnline ? "bg-[#4ADE80]/10 border-[#4ADE80]/25" : "bg-[#F4C76A]/10 border-[#F4C76A]/25"
    }`}>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-[#4ADE80]" : "bg-[#F4C76A]"}`} />
        <span className={`text-[12px] ${isOnline ? "text-[#4ADE80]" : "text-[#F4C76A]"}`}>
          Ish holatingiz: <span className="font-semibold">{isOnline ? "Faol" : "Band"}</span>
        </span>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
      >
        {saving ? "…" : isOnline ? "Band deb belgilash" : "Faol deb belgilash"}
      </button>
    </div>
  );
}

function TelegramLinkWidget() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const checkStatus = () => {
    fetch("/api/admin/telegram-link")
      .then((r) => r.json())
      .then((data) => setLinked(!!data.linked))
      .catch(() => setLinked(null));
  };

  useEffect(() => { checkStatus(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/telegram-link", { method: "POST" });
      const data = await res.json();
      if (data.code) setCode(data.code);
    } finally {
      setGenerating(false);
    }
  };

  const unlink = async () => {
    setUnlinking(true);
    try {
      await fetch("/api/admin/telegram-link", { method: "DELETE" });
      setCode("");
      checkStatus();
    } finally {
      setUnlinking(false);
    }
  };

  if (linked === true) {
    return (
      <div className="mb-4 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-3.5 py-2.5 text-[12px] text-[#4ADE80] flex items-center justify-between gap-3">
        <span>✓ Telegram ulangan — yangi buyurtmalar haqida xabar kelib turadi.</span>
        <button onClick={unlink} disabled={unlinking} className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white">
          {unlinking ? "…" : "Uzish"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 text-[12px] text-[#F4C76A]">
      <div className="mb-2">Telegram ulanmagan — yangi buyurtmalar haqida xabar olmaysiz.</div>
      {code ? (
        <div className="text-white/90">
          Botga yuboring: <span className="font-mono font-bold">/link {code}</span> (10 daqiqa amal qiladi)
        </div>
      ) : (
        <button onClick={generate} disabled={generating} className="px-3 py-1.5 rounded-lg bg-[#F4C76A]/20 border border-[#F4C76A]/40 text-[11px] font-semibold">
          {generating ? "…" : "Kod olish"}
        </button>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "completed" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Order | null>(null);
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [onlyToday, setOnlyToday] = useState(false);
  const [onlyUnclaimed, setOnlyUnclaimed] = useState(false);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("telegram_orders")
      .select("id, type, platform, account_id, amount, payment_method, withdraw_code, payout_details, recipient_name, receipt_path, status, operator_note, operator_id, claimed_by, payment_operator_id, received_account_number, received_holder_name, player_name, auto_processed, created_at, customers(phone, full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setOrders((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
    fetch("/api/admin/telegram-orders/operators-list")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const op of data.operators ?? []) map[op.id] = op.name;
        setOperatorNames(map);
      })
      .catch(() => {});
  }, []);

  const openOrder = async (o: Order) => {
    if (o.status !== "pending") { setSelected(o); return; }
    setSelected(o);
    try {
      const res = await fetch("/api/admin/telegram-orders/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id }),
      });
      const data = await res.json();
      if (data.claimedBy) {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, claimed_by: data.claimedBy } : x)));
        setSelected((prev) => (prev && prev.id === o.id ? { ...prev, claimed_by: data.claimedBy } : prev));
      }
    } catch {}
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filtered = orders.filter((o) => {
    if (operatorFilter !== "all") {
      const owner = o.status === "pending" ? o.claimed_by : o.operator_id;
      if (owner !== operatorFilter) return false;
    }
    if (onlyToday && new Date(o.created_at) < todayStart) return false;
    if (onlyUnclaimed && (o.status !== "pending" || o.claimed_by)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${o.account_id} ${o.platform} ${o.customers?.phone ?? ""} ${o.customers?.full_name ?? ""} ${o.player_name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <MyStatusToggle />
      <TelegramLinkWidget />
      <Can permission="telegram_operators.manage"><LimitsEditor /></Can>
      <CashdeskBalanceBadge />

      <input
        className="w-full mb-3 bg-white/5 border border-white/10 rounded-lg py-2 px-3.5 text-[13px] outline-none focus:border-accent"
        placeholder="Qidirish: hisob ID, telefon, ism, platforma..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 mb-3 overflow-x-auto">
        {ORDER_STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border whitespace-nowrap ${
              filter === f.id ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          value={operatorFilter}
          onChange={(e) => setOperatorFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px]"
        >
          <option value="all">Barcha operatorlar</option>
          {currentUserId && <option value={currentUserId}>Faqat mening</option>}
          {Object.entries(operatorNames).filter(([id]) => id !== currentUserId).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button
          onClick={() => setOnlyToday((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-[12px] border ${onlyToday ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
        >
          Bugun
        </button>
        <button
          onClick={() => setOnlyUnclaimed((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-[12px] border ${onlyUnclaimed ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"}`}
        >
          Band qilinmagan
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Bu holatda buyurtmalar yo'q.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => {
            const owner = o.status === "pending" ? o.claimed_by : o.operator_id;
            const ownerName = owner ? operatorNames[owner] : null;
            return (
              <button
                key={o.id}
                onClick={() => openOrder(o)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left hover:border-accent/40 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-1.5">
                    {o.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"} · {o.platform}
                    {o.auto_processed && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">API</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {o.customers?.full_name || o.customers?.phone || "—"} · {o.player_name ? `${o.player_name} (ID: ${o.account_id})` : `ID: ${o.account_id}`} · {o.payment_method}
                  </div>
                  {o.type === "topup" && o.payment_operator_id && (
                    <div className="text-[10px] text-[#F4C76A] mt-0.5">
                      💳 {operatorNames[o.payment_operator_id] ?? "noma'lum"} kartasiga to'landi
                    </div>
                  )}
                  {ownerName && (
                    <div className="text-[10px] text-accent mt-1">
                      {o.status === "pending" ? `🔵 ${ownerName} ko'rib chiqmoqda` : `${ownerName} bajardi`}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-bold">{Number(o.amount).toLocaleString("ru-RU")}</div>
                  <div
                    className={`text-[11px] font-medium ${
                      o.status === "pending" ? "text-[#F4C76A]" : o.status === "completed" ? "text-[#4ADE80]" : "text-[#FF6B85]"
                    }`}
                  >
                    {o.status === "pending" ? "Kutilmoqda" : o.status === "completed" ? "Bajarildi" : "Rad etildi"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ResolveModal
          order={selected}
          operatorNames={operatorNames}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const reply = async () => {
    if (!text.trim()) return;
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
                m.message
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

function SupportTab() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [activeCustomer, setActiveCustomer] = useState<SupportThread | null>(null);
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
      supabase.from("telegram_support_threads").select("customer_id, is_archived, claimed_by, profiles(display_name, full_name)"),
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

type OperatorPaymentMethod = {
  id: string;
  method_type: "card" | "click" | "payme" | "crypto";
  account_number: string;
  holder_name: string | null;
  is_active: boolean;
  usage_count: number;
  usage_limit: number | null;
};

const METHOD_TYPE_LABELS: Record<OperatorPaymentMethod["method_type"], string> = {
  card: "Bank kartasi",
  click: "Click",
  payme: "Payme",
  crypto: "USDT (TRC20)",
};

function MyPaymentMethodsTab() {
  const [methods, setMethods] = useState<OperatorPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ method_type: OperatorPaymentMethod["method_type"]; account_number: string; holder_name: string; usage_limit: string }>({
    method_type: "card", account_number: "", holder_name: "", usage_limit: "",
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("telegram_operator_payment_methods")
      .select("id, method_type, account_number, holder_name, is_active, usage_count, usage_limit")
      .eq("operator_id", user.id)
      .order("method_type");
    setMethods((data as OperatorPaymentMethod[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.account_number.trim()) return;
    setSaving(true);
    if (editingId) {
      await supabase.from("telegram_operator_payment_methods").update({
        method_type: form.method_type,
        account_number: form.account_number.trim(),
        holder_name: form.holder_name.trim() || null,
        usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
      }).eq("id", editingId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("telegram_operator_payment_methods").insert({
          operator_id: user.id,
          method_type: form.method_type,
          account_number: form.account_number.trim(),
          holder_name: form.holder_name.trim() || null,
          usage_limit: form.usage_limit.trim() ? Number(form.usage_limit) : null,
        });
      }
    }
    setSaving(false);
    setForm({ method_type: "card", account_number: "", holder_name: "", usage_limit: "" });
    setEditingId(null);
    setShowForm(false);
    load();
  };

  const startEdit = (m: OperatorPaymentMethod) => {
    setForm({ method_type: m.method_type, account_number: m.account_number, holder_name: m.holder_name ?? "", usage_limit: m.usage_limit != null ? String(m.usage_limit) : "" });
    setEditingId(m.id);
    setShowForm(true);
  };

  const startAdd = () => {
    setForm({ method_type: "card", account_number: "", holder_name: "", usage_limit: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const toggleActive = async (m: OperatorPaymentMethod) => {
    await supabase.from("telegram_operator_payment_methods").update({ is_active: !m.is_active }).eq("id", m.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    await supabase.from("telegram_operator_payment_methods").delete().eq("id", id);
    load();
  };

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda...</p>;

  return (
    <div className="max-w-lg">
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        Bu — sizning shaxsiy to'lov rekvizitlaringiz. Mijoz Mini App'da hisob to'ldirishni tanlaganda, faol
        rekvizitlar orasidan tasodifiy biri ko'rsatiladi — shu bilan to'lovlar operatorlar orasida taqsimlanadi.
        Rekvizitni istalgan vaqt tahrirlab (masalan har kuni boshqa kartaga) almashtira olasiz.
      </p>

      {methods.length === 0 && !showForm && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 text-center text-[13px] text-muted mb-4">
          Hali rekvizit qo'shmagansiz.
        </div>
      )}

      <div className="flex flex-col gap-5 mb-5">
        {methods.map((m) => (
          <div key={m.id}>
            <LuxuryCard
              typeLabel={METHOD_TYPE_LABELS[m.method_type]}
              number={m.account_number}
              holderName={m.holder_name}
              active={m.is_active}
              onToggleActive={() => toggleActive(m)}
              onEdit={() => startEdit(m)}
              onDelete={() => remove(m.id)}
            />
            {m.usage_limit != null && (
              <div className="text-[11px] text-muted mt-1.5 max-w-[340px]">
                Ishlatilgan: <span className={m.usage_count >= m.usage_limit ? "text-[#FF6B85] font-semibold" : "text-white font-semibold"}>{m.usage_count}</span> / {m.usage_limit}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={submitForm} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[13px] font-semibold mb-3">{editingId ? "Rekvizitni tahrirlash" : "Yangi rekvizit"}</div>
          <div className="mb-3">
            <label className="block text-[12px] text-muted mb-1.5">Turi</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px]"
              value={form.method_type}
              onChange={(e) => setForm((prev) => ({ ...prev, method_type: e.target.value as OperatorPaymentMethod["method_type"] }))}
            >
              {(Object.keys(METHOD_TYPE_LABELS) as OperatorPaymentMethod["method_type"][]).map((k) => (
                <option key={k} value={k}>{METHOD_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-[12px] text-muted mb-1.5">Raqam / manzil</label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
              value={form.account_number}
              onChange={(e) => setForm((prev) => ({ ...prev, account_number: e.target.value }))}
              placeholder={form.method_type === "crypto" ? "T..." : "+998 90 123 45 67"}
            />
          </div>
          {form.method_type !== "crypto" && (
            <div className="mb-4">
              <label className="block text-[12px] text-muted mb-1.5">Egasining F.I.Sh.</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
                value={form.holder_name}
                onChange={(e) => setForm((prev) => ({ ...prev, holder_name: e.target.value }))}
                placeholder="Masalan: Aliyev Vali"
              />
            </div>
          )}
          <div className="mb-4">
            <label className="block text-[12px] text-muted mb-1.5">Ishlatilish limiti (ixtiyoriy)</label>
            <input
              type="number"
              min={1}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
              value={form.usage_limit}
              onChange={(e) => setForm((prev) => ({ ...prev, usage_limit: e.target.value }))}
              placeholder="Masalan: 20 — shuncha marta ishlatilgach o'chiriladi"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px]">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : editingId ? "Saqlash" : "Qo'shish"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"
        >
          <CreditCard size={15} /> Yangi rekvizit qo'shish
        </button>
      )}
    </div>
  );
}

export default function TelegramBotAdminPage() {
  const [tab, setTab] = useState<"orders" | "operators" | "chat" | "support" | "my-payments">("orders");

  if (tab === "chat") {
    return (
      <div className="fixed inset-0 z-40 bg-bg flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8 shrink-0">
          <button onClick={() => setTab("orders")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10" aria-label="Orqaga">
            <ChevronLeft size={20} />
          </button>
          <MessageCircle size={18} className="text-accent" />
          <h1 className="text-[16px] font-bold">Jamoa chati</h1>
        </div>
        <div className="flex-1 p-4 min-h-0">
          <Can permission="team_chat.use"><ChatTab /></Can>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">BetCore Pay</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">Telegram Mini App orqali hisob to'ldirish/yechish xizmatini boshqarish.</p>

      <div className="flex gap-2 mb-6 border-b border-white/8 overflow-x-auto">
        <button
          onClick={() => setTab("orders")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap ${tab === "orders" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          Buyurtmalar
        </button>
        <button
          onClick={() => setTab("support")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "support" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          <Headset size={14} /> Murojaatlar
        </button>
        <Can permission="telegram_operators.manage">
          <button
            onClick={() => setTab("operators")}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "operators" ? "border-accent text-white" : "border-transparent text-muted"}`}
          >
            <UsersIcon size={14} /> Operatorlar
          </button>
        </Can>
        <Can permission="team_chat.use">
          <button
            onClick={() => setTab("chat")}
            className="px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap border-transparent text-muted"
          >
            <MessageCircle size={14} /> Jamoa chati
          </button>
        </Can>
        <button
          onClick={() => setTab("my-payments")}
          className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "my-payments" ? "border-accent text-white" : "border-transparent text-muted"}`}
        >
          <CreditCard size={14} /> Mening to'lovlarim
        </button>
      </div>

      {tab === "orders" && <OrdersTab />}
      {tab === "support" && <SupportTab />}
      {tab === "operators" && <Can permission="telegram_operators.manage"><OperatorsTab /></Can>}
      {tab === "my-payments" && <MyPaymentMethodsTab />}
    </div>
  );
}
