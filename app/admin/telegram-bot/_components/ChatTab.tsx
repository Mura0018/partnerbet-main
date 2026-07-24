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

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#F4C76A",
  admin: "#3D7FFF",
  operator: "#4ADE80",
};

// 8-BOSQICH: tizim hodisalari turlari (rang/yorliq bilan ajratish).
const EVENT_META: Record<string, { label: string; color: string }> = {
  handoff: { label: "Handoff", color: "#3D7FFF" },
  debt: { label: "Qarz", color: "#F4C76A" },
  alert: { label: "Alert", color: "#FF6B85" },
  status: { label: "Holat", color: "#93a5ba" },
};


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
  event_type: string | null;
  profiles: { full_name: string | null; display_name: string | null; avatar_url: string | null; is_online: boolean | null; roles: { key: string } | null } | null;
};


export function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [myTheme, setMyTheme] = useState<string>("blue");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "chat" | "system">("all");
  const [rules, setRules] = useState<string>("");
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState("");
  const [savingRules, setSavingRules] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstScrollRef = useRef(true);
  const voiceRecorder = useVoiceRecorder();
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("team_chat_messages")
      .select("id, message, image_path, file_name, voice_path, voice_duration_seconds, created_at, sender_id, reply_to_id, is_system, event_type, profiles!sender_id(full_name, display_name, avatar_url, is_online, roles(key))")
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

  // 8-BOSQICH: pinned qoidalar + faol (smenada) operatorlar soni.
  useEffect(() => {
    fetch("/api/admin/team-chat-rules")
      .then((r) => r.json())
      .then((d) => { if (typeof d.text === "string") setRules(d.text); })
      .catch(() => {});
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_online", true)
      .then(({ count }) => setOnlineCount(count ?? 0));
  }, []);

  const saveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch("/api/admin/team-chat-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rulesDraft }),
      });
      const d = await res.json();
      if (res.ok) { setRules(d.text ?? rulesDraft); setEditingRules(false); }
    } finally {
      setSavingRules(false);
    }
  };

  const changeMyTheme = async (next: string) => {
    setMyTheme(next);
    setShowThemePicker(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ chat_theme: next }).eq("id", user.id);
  };

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
  }, [messages.length]);

  const send = async () => {
    if (sending || !text.trim()) return;
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

  const filtered = messages.filter((m) => {
    if (typeFilter === "chat" && m.is_system) return false;
    if (typeFilter === "system" && !m.is_system) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${m.message ?? ""} ${m.file_name ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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

      {/* 8-BOSQICH: pinned qoidalar */}
      <div className="px-3 py-2 border-b border-white/8 bg-white/[0.02]">
        <div className="flex items-start gap-2">
          <span className="text-[11px] shrink-0">📌</span>
          {editingRules ? (
            <div className="flex-1 min-w-0">
              <textarea
                rows={3}
                value={rulesDraft}
                onChange={(e) => setRulesDraft(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[11px] outline-none focus:border-accent"
              />
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={saveRules} disabled={savingRules} className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/20 text-white disabled:opacity-50">Saqlash</button>
                <button onClick={() => setEditingRules(false)} className="text-[11px] px-2.5 py-1 rounded-lg text-muted hover:bg-white/5">Bekor</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[#cdd7e5] whitespace-pre-wrap">{rules || "Qoidalar belgilanmagan."}</div>
              <Can permission="operators.oversight">
                <button onClick={() => { setRulesDraft(rules); setEditingRules(true); }} className="text-[10px] text-accent mt-0.5">Tahrirlash</button>
              </Can>
            </div>
          )}
        </div>
      </div>

      {/* 8-BOSQICH: tur filtri + faol (smenada) operatorlar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/8">
        {([["all", "Hammasi"], ["chat", "Suhbat"], ["system", "Tizim"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTypeFilter(id)}
            className={`text-[11px] px-2.5 py-1 rounded-lg ${typeFilter === id ? "bg-accent/20 text-white" : "text-muted hover:bg-white/5"}`}
          >
            {label}
          </button>
        ))}
        {onlineCount != null && (
          <span className="ml-auto text-[11px] text-[#4ADE80] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />Faol: {onlineCount}
          </span>
        )}
      </div>
      <div
        ref={listRef}
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
            const meta = m.event_type ? EVENT_META[m.event_type] : null;
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span
                  className="text-[10.5px] rounded-full px-3 py-1 border max-w-[90%] text-center whitespace-pre-wrap"
                  style={meta
                    ? { color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }
                    : { color: "#93a5ba", borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)" }}
                >
                  {meta && <span className="font-bold mr-1">[{meta.label}]</span>}
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

