"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Msg = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string | null;
  partner_id: string | null;
  is_system: boolean;
  profiles?: { full_name: string | null } | null;
  partners?: { name: string | null } | null;
};

// Hamkorlar aro + platforma umumiy chati (global_chat_messages).
export function GlobalChat() {
  const supabase = createClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("global_chat_messages")
      .select("id, message, created_at, sender_id, partner_id, is_system, profiles(full_name), partners(name)")
      .order("created_at", { ascending: true })
      .limit(300);
    setMessages((data as any[]) ?? []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data: pid } = await supabase.rpc("current_partner_id");
      setPartnerId((pid as string) ?? null);
      await load();
    })();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !userId) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("global_chat_messages").insert({ message: body, sender_id: userId, partner_id: partnerId });
    setSending(false);
    if (error) { setText(body); return; }
    load(true);
  };

  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-white/8 bg-white/[0.02]">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
        {loading ? (
          <p className="text-[13px] text-muted text-center py-6">Yuklanmoqda...</p>
        ) : messages.length === 0 ? (
          <p className="text-[13px] text-muted text-center py-6">Hozircha xabar yo'q. Birinchi bo'lib yozing.</p>
        ) : messages.map((m) => {
          const isMe = m.sender_id === userId;
          const name = m.profiles?.full_name || "—";
          const org = m.partners?.name;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isMe ? "bg-accent/20" : "bg-white/[0.05]"}`}>
                {!isMe && (
                  <div className="text-[10.5px] font-semibold mb-0.5 text-[#7db8ff]">
                    {name}{org ? <span className="text-muted font-normal"> · {org}</span> : <span className="text-muted font-normal"> · Platforma</span>}
                  </div>
                )}
                <div className="text-[13px] whitespace-pre-wrap break-words">{m.message}</div>
              </div>
              <div className="text-[9px] text-[#5b6f85] mt-0.5 px-1">{new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-white/8 shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Xabar yozing..."
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-r from-accent to-accent-dim disabled:opacity-50" aria-label="Yuborish">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
