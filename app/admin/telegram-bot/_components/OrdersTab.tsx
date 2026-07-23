"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can, useCurrentProfile } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

const REJECT_REASON_TEMPLATES = [
  "To'lov cheki noaniq/mos emas",
  "Hisob ID noto'g'ri yoki topilmadi",
  "Summasi to'lovga mos kelmayapti",
  "Pul yechish kodi noto'g'ri",
  "Takroriy buyurtma",
];


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
  handoff_open: boolean;
  sla_deadline: string | null;
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

        {order.status === "pending" ? (
        <>
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
        </>
        ) : (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3.5 py-3 text-[13px]">
            <span className={`font-semibold ${order.status === "completed" ? "text-[#4ADE80]" : "text-[#FF6B85]"}`}>
              {order.status === "completed" ? "✓ Bajarilgan buyurtma" : "✕ Rad etilgan buyurtma"}
            </span>
            {order.operator_note && <div className="text-[12px] text-muted mt-1.5">Izoh: {order.operator_note}</div>}
          </div>
        )}
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
  const [saveError, setSaveError] = useState(false);
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
    setSaveError(false);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("site_settings")
      .update({
        value: { max_order_amount: Number(values.max_order_amount) || 0, daily_customer_limit: Number(values.daily_customer_limit) || 0 },
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "betcore_pay_limits");
    setSaving(false);
    if (error) {
      setSaveError(true);
      return;
    }
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
        {saveError && <span className="text-[11px] text-[#FF6B85] self-center">Saqlanmadi. Qayta urinib ko'ring.</span>}
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

// 4-BOSQICH: operator band holati (is_busy + sabab). is_online dan alohida.
// Band bo'lganда — buyurtmalari SLA/cron orqali boshqa operatorga o'tishi mumkin.
function MyBusyToggle() {
  const [isBusy, setIsBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("is_busy, busy_reason").eq("id", user.id).maybeSingle();
      if (data) { setIsBusy((data as any).is_busy ?? false); setReason((data as any).busy_reason ?? ""); }
      setLoading(false);
    });
  }, []);

  const toggle = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const next = !isBusy;
    const { data: profile } = await supabase.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle();
    const name = profile?.display_name || profile?.full_name || "Operator";
    const nextReason = next ? reason.trim() : "";

    await supabase.from("profiles").update({ is_busy: next, busy_reason: nextReason || null }).eq("id", user.id);
    await supabase.from("team_chat_messages").insert({
      sender_id: user.id,
      is_system: true,
      message: next
        ? `⛔ ${name} bandman deb belgiladi${nextReason ? ` (${nextReason})` : ""} — buyurtmalari boshqa operatorga o'tishi mumkin.`
        : `✅ ${name} yana bo'sh.`,
    });
    setIsBusy(next);
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className={`mb-4 rounded-lg px-3.5 py-2.5 border ${isBusy ? "bg-[#FF6B85]/10 border-[#FF6B85]/25" : "bg-white/[0.02] border-white/8"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isBusy ? "bg-[#FF6B85]" : "bg-[#4ADE80]"}`} />
          <span className={`text-[12px] ${isBusy ? "text-[#FF6B85]" : "text-muted"}`}>
            Bandlik: <span className="font-semibold">{isBusy ? "Bandman" : "Bo'shman"}</span>
            {isBusy && reason ? <span className="text-[11px]"> — {reason}</span> : null}
          </span>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
        >
          {saving ? "…" : isBusy ? "Bo'shman deb belgilash" : "Bandman deb belgilash"}
        </button>
      </div>
      {!isBusy && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Band sababi (ixtiyoriy) — masalan: tushlik, boshqa ish"
          className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px] outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

function TelegramLinkWidget() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [code, setCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const checkStatus = () => {
    setStatusError(false);
    fetch("/api/admin/telegram-link")
      .then((r) => r.json())
      .then((data) => setLinked(!!data.linked))
      .catch(() => { setLinked(null); setStatusError(true); });
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

  if (statusError) {
    return (
      <div className="mb-4 rounded-lg bg-white/[0.02] border border-white/8 px-3.5 py-2.5 text-[12px] text-muted">
        Telegram ulanish holatini tekshirib bo'lmadi.
      </div>
    );
  }

  if (linked === null) {
    return (
      <div className="mb-4 rounded-lg bg-white/[0.02] border border-white/8 px-3.5 py-2.5 text-[12px] text-muted">
        Telegram ulanish holati tekshirilmoqda…
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

export function OrdersTab() {
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
  const { profile } = useCurrentProfile();
  const isSuperAdmin = profile?.roles?.key === "super_admin";

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("telegram_orders")
      .select("id, type, platform, account_id, amount, payment_method, withdraw_code, payout_details, recipient_name, receipt_path, status, operator_note, operator_id, claimed_by, payment_operator_id, received_account_number, received_holder_name, player_name, auto_processed, handoff_open, sla_deadline, created_at, customers(phone, full_name)")
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

  // 4-BOSQICH: handoff'ga chiqqan buyurtmani atomik "Olaman". Server WHERE
  // handoff_open=true bilan lock qiladi — ikki operator bosса bittasi yutadi.
  const takeover = async (o: Order) => {
    try {
      const res = await fetch("/api/admin/telegram-orders/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id }),
      });
      const data = await res.json();
      if (!data.ok) alert("Boshqa operator ulgurdi yoki buyurtma allaqachon hal qilingan.");
    } catch {
      /* tarmoq xatosi — jim */
    } finally {
      load();
    }
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
      {/* Ish holati va Telegram xabarnomasi — faqat xodimlar uchun (super admin buyurtma qayta ishlamaydi) */}
      {!isSuperAdmin && <MyStatusToggle />}
      {!isSuperAdmin && <MyBusyToggle />}
      {!isSuperAdmin && <TelegramLinkWidget />}
      <Can permission="telegram_operators.manage"><LimitsEditor /></Can>
      <CashdeskBalanceBadge />

      {/* Minimal boshqaruv paneli: qidiruv + filtrlar */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 mb-4">
        <div className="relative mb-2.5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent"
            placeholder="Qidirish: ID, telefon, ism, platforma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ORDER_STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                filter === f.id ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px bg-white/10 hidden sm:block" />

          <button
            onClick={() => setOnlyToday((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${onlyToday ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"}`}
          >
            Bugun
          </button>
          <button
            onClick={() => setOnlyUnclaimed((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${onlyUnclaimed ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"}`}
          >
            Band emas
          </button>
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="ml-auto bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px] outline-none focus:border-accent"
          >
            <option value="all">Barcha operatorlar</option>
            {currentUserId && <option value={currentUserId}>Faqat mening</option>}
            {Object.entries(operatorNames).filter(([id]) => id !== currentUserId).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
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
                  {o.status === "pending" && o.handoff_open && o.claimed_by !== currentUserId && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); takeover(o); }}
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-[#F4C76A]/15 border border-[#F4C76A]/40 text-[#F4C76A] font-semibold cursor-pointer hover:bg-[#F4C76A]/25"
                    >
                      ⚠️ Javob yo'q — Olaman
                    </span>
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

