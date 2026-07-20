"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#F4C76A",
  admin: "#3D7FFF",
  operator: "#4ADE80",
};

type ChatMessage = {
  id: string;
  message: string;
  created_at: string;
  sender_id: string;
  profiles: { full_name: string | null; display_name: string | null; avatar_url: string | null; roles: { key: string } | null } | null;
};

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("team_chat_messages")
      .select("id, message, created_at, sender_id, profiles(full_name, display_name, avatar_url, roles(key))")
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages((data as any[]) ?? []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("team_chat_messages").insert({ sender_id: user.id, message: text.trim() });
      setText("");
      await load();
    }
    setSending(false);
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] flex flex-col h-[520px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-[13px] text-muted text-center mt-8">Hozircha xabar yo'q. Birinchi bo'lib yozing.</p>
        )}
        {messages.map((m) => {
          const roleKey = m.profiles?.roles?.key ?? "user";
          const color = ROLE_COLOR[roleKey] ?? "#5b6f85";
          const name = m.profiles?.display_name || m.profiles?.full_name || "?";
          return (
            <div key={m.id} className="flex items-start gap-2.5">
              {m.profiles?.avatar_url ? (
                <img src={m.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border shrink-0" style={{ borderColor: color }} />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 border"
                  style={{ borderColor: color, color, background: `${color}1a` }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-bold" style={{ color }}>{name}</span>
                  <span className="text-[10px] text-[#5b6f85]">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-[13px] text-white/90 break-words">{m.message}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 p-3 border-t border-white/8">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
          placeholder="Xabar yozing..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={sending || !text.trim()} className="px-3.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim disabled:opacity-50">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

type OperatorRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  telegram_region: string | null;
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
      .select("id, full_name, is_active, telegram_region, roles!inner(key)")
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
                <div className="text-[13px] font-semibold">{op.full_name || "(ism kiritilmagan)"}</div>
                <div className={`text-[11px] mt-0.5 ${op.is_active ? "text-[#4ADE80]" : "text-[#5b6f85]"}`}>
                  {op.is_active ? "Faol" : "O'chirilgan"}
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
  status: "pending" | "completed" | "rejected";
  operator_note: string | null;
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

function ResolveModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">{order.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"}</h2>
          <button onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <div className="space-y-1.5 text-[13px] mb-4">
          <div><span className="text-muted">Mijoz:</span> {order.customers?.full_name || order.customers?.phone || "—"}</div>
          <div><span className="text-muted">Platforma:</span> {order.platform}</div>
          <div><span className="text-muted">Hisob ID:</span> {order.account_id}</div>
          {order.player_name && (
            <div>
              <span className="text-muted">O'yinchi ismi:</span>{" "}
              <span className="text-[#4ADE80] font-medium">{order.player_name}</span>
              <span className="text-[10px] text-[#5b6f85] ml-1">(kassa API orqali tekshirildi)</span>
            </div>
          )}
          <div><span className="text-muted">Summa:</span> {Number(order.amount).toLocaleString("ru-RU")}</div>
          <div><span className="text-muted">To'lov usuli:</span> {order.payment_method}</div>
          {order.withdraw_code && <div><span className="text-muted">Yechish kodi:</span> {order.withdraw_code}</div>}
          {order.payout_details && <div><span className="text-muted">Qabul qiluvchi:</span> {order.payout_details}</div>}
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

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "completed" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Order | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("telegram_orders")
      .select("id, type, platform, account_id, amount, payment_method, withdraw_code, payout_details, status, operator_note, player_name, auto_processed, created_at, customers(phone, full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setOrders((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <CashdeskBalanceBadge />
      <div className="flex gap-2 mb-4">
        {ORDER_STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${
              filter === f.id ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Bu holatda buyurtmalar yo'q.
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => o.status === "pending" && setSelected(o)}
              className={`w-full flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left ${
                o.status === "pending" ? "hover:border-accent/40 cursor-pointer" : "cursor-default"
              }`}
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
          ))}
        </div>
      )}

      {selected && (
        <ResolveModal
          order={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

type SupportThread = { customer_id: string; phone: string; full_name: string | null; last_message: string; last_at: string };
type SupportMsg = { id: string; sender: "customer" | "operator"; message: string; created_at: string };

function SupportTab() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<SupportThread | null>(null);
  const [msgs, setMsgs] = useState<SupportMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadThreads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("telegram_support_messages")
      .select("customer_id, message, created_at, customers(phone, full_name)")
      .order("created_at", { ascending: false })
      .limit(300);
    const grouped = new Map<string, SupportThread>();
    for (const row of (data as any[]) ?? []) {
      if (!grouped.has(row.customer_id)) {
        grouped.set(row.customer_id, {
          customer_id: row.customer_id,
          phone: row.customers?.phone ?? "—",
          full_name: row.customers?.full_name ?? null,
          last_message: row.message,
          last_at: row.created_at,
        });
      }
    }
    setThreads(Array.from(grouped.values()));
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 6000);
    return () => clearInterval(interval);
  }, []);

  const loadThread = async (customerId: string) => {
    const { data } = await supabase
      .from("telegram_support_messages")
      .select("id, sender, message, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMsgs((data as any[]) ?? []);
  };

  useEffect(() => {
    if (!activeCustomer) return;
    loadThread(activeCustomer.customer_id);
    const interval = setInterval(() => loadThread(activeCustomer.customer_id), 4000);
    return () => clearInterval(interval);
  }, [activeCustomer?.customer_id]);

  const reply = async () => {
    if (!text.trim() || !activeCustomer) return;
    setSending(true);
    try {
      await fetch("/api/admin/telegram-orders/support-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: activeCustomer.customer_id, message: text.trim() }),
      });
      setText("");
      await loadThread(activeCustomer.customer_id);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda...</p>;

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4 h-[520px]">
      <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-y-auto">
        {threads.length === 0 ? (
          <p className="text-[12px] text-muted text-center p-6">Hozircha murojaat yo'q.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.customer_id}
              onClick={() => setActiveCustomer(t)}
              className={`w-full text-left p-3.5 border-b border-white/5 ${
                activeCustomer?.customer_id === t.customer_id ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="text-[12px] font-semibold truncate">{t.full_name || t.phone}</div>
              <div className="text-[11px] text-muted truncate mt-0.5">{t.last_message}</div>
            </button>
          ))
        )}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] flex flex-col">
        {!activeCustomer ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-muted">Murojaatni tanlang</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "operator" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-[13px] ${m.sender === "operator" ? "bg-gradient-to-r from-accent to-accent-dim" : "bg-white/[0.06]"}`}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-3 border-t border-white/8">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
                placeholder="Javob yozing..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reply()}
              />
              <button onClick={reply} disabled={sending || !text.trim()} className="px-3.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim disabled:opacity-50">
                <Send size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentInfoTab() {
  const [values, setValues] = useState({ card_number: "", click_number: "", payme_number: "", crypto_wallet: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "betcore_pay_payment_info").maybeSingle();
      if (data?.value) setValues((prev) => ({ ...prev, ...(data.value as any) }));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("site_settings")
      .update({ value: values, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("key", "betcore_pay_payment_info");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p className="text-[13px] text-muted">Yuklanmoqda...</p>;

  const fields: { key: keyof typeof values; label: string; placeholder: string }[] = [
    { key: "card_number", label: "Bank karta raqami", placeholder: "8600 1234 5678 9012" },
    { key: "click_number", label: "Click raqami", placeholder: "+998 90 123 45 67" },
    { key: "payme_number", label: "Payme raqami", placeholder: "+998 90 123 45 67" },
    { key: "crypto_wallet", label: "USDT (TRC20) wallet", placeholder: "T..." },
  ];

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 max-w-lg">
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        Bu ma'lumotlar Mini App'da mijozga to'lov usulini tanlaganda ko'rsatiladi — maxfiy emas, shuning uchun
        oddiy matn sifatida saqlanadi.
      </p>
      {fields.map((f) => (
        <div key={f.key} className="mb-3.5">
          <label className="block text-[12px] text-muted mb-1.5">{f.label}</label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] text-white outline-none focus:border-accent"
            placeholder={f.placeholder}
            value={values[f.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-60"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saving ? "Saqlanmoqda…" : saved ? "Saqlandi" : "Saqlash"}
      </button>
    </div>
  );
}

export default function TelegramBotAdminPage() {
  const [tab, setTab] = useState<"orders" | "operators" | "chat" | "support" | "payment-info">("orders");

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
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "chat" ? "border-accent text-white" : "border-transparent text-muted"}`}
          >
            <MessageCircle size={14} /> Jamoa chati
          </button>
        </Can>
        <Can permission="settings.manage">
          <button
            onClick={() => setTab("payment-info")}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${tab === "payment-info" ? "border-accent text-white" : "border-transparent text-muted"}`}
          >
            <CreditCard size={14} /> To'lov ma'lumotlari
          </button>
        </Can>
      </div>

      {tab === "orders" && <OrdersTab />}
      {tab === "support" && <SupportTab />}
      {tab === "operators" && <Can permission="telegram_operators.manage"><OperatorsTab /></Can>}
      {tab === "chat" && <Can permission="team_chat.use"><ChatTab /></Can>}
      {tab === "payment-info" && <Can permission="settings.manage"><PaymentInfoTab /></Can>}
    </div>
  );
}
