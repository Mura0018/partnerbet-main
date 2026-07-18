"use client";

import React, { useEffect, useState } from "react";
import { Send, Users, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

export default function PushNotificationsPage() {
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", url: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipients: number; failures: number } | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const [{ count }, { data: logData }] = await Promise.all([
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
      supabase.from("push_notification_log").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    setSubscriberCount(count ?? 0);
    setLog(logData ?? []);
  };
  useEffect(() => { load(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!form.title.trim() || !form.body.trim()) { setError("Sarlavha va matn kiritilishi shart."); return; }
    if (!confirm(`Xabar ${subscriberCount ?? 0} ta obunachiga yuborilsinmi?`)) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Xatolik yuz berdi."); return; }
      setResult(json);
      setForm({ title: "", body: "", url: "" });
      load();
    } catch {
      setError("Xatolik yuz berdi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[22px] font-bold mb-1">Push Notifications</h1>
      <p className="text-[13px] text-muted mb-6">
        Barcha obuna bo'lgan tashrifchilarga bildirishnoma yuboring. Kalitlarni{" "}
        <a href="/admin/settings" className="text-accent hover:underline">Sozlamalar &gt; API kalitlar</a> bo'limidan sozlang.
      </p>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-6 flex items-center gap-3">
        <Users size={16} className="text-accent" />
        <span className="text-[13px]">
          <span className="font-bold">{subscriberCount ?? "…"}</span> ta obunachi
        </span>
      </div>

      <form onSubmit={send} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6 space-y-3">
        <input className={inputCls} placeholder="Sarlavha" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea rows={3} className={inputCls} placeholder="Xabar matni" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <input className={inputCls} placeholder="Havola (ixtiyoriy, masalan /blog/yangi-maqola)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        {result && <p className="text-[12px] text-[#4ADE80]">Yuborildi: {result.recipients} ta, xato: {result.failures} ta.</p>}
        <button type="submit" disabled={sending} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-60">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? "Yuborilmoqda…" : "Yuborish"}
        </button>
      </form>

      <h2 className="text-[15px] font-bold mb-3">So'nggi yuborilganlar</h2>
      <div className="space-y-2">
        {log.map((l) => (
          <div key={l.id} className="rounded-lg border border-white/8 p-3">
            <div className="text-[13px] font-medium">{l.title}</div>
            <div className="text-[11px] text-[#5b6f85] mt-1">{new Date(l.created_at).toLocaleString()} · {l.recipients_count} yuborildi, {l.failures_count} xato</div>
          </div>
        ))}
        {log.length === 0 && <p className="text-[12px] text-[#5b6f85]">Hozircha yuborilmagan.</p>}
      </div>
    </div>
  );
}
