"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, ChevronRight, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can, useCurrentProfile } from "@/lib/auth/permissions";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

const REJECT_REASON_KEYS = ["ord.rt1", "ord.rt2", "ord.rt3", "ord.rt4", "ord.rt5"];


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
  payout_done: boolean;
  handoff_open: boolean;
  sla_deadline: string | null;
  created_at: string;
  customers: { phone: string; full_name: string | null } | null;
};

const ORDER_STATUS_FILTERS: { id: "pending" | "completed" | "rejected" | "all"; labelKey: string }[] = [
  { id: "pending", labelKey: "ord.fPending" },
  { id: "completed", labelKey: "ord.fCompleted" },
  { id: "rejected", labelKey: "ord.fRejected" },
  { id: "all", labelKey: "ord.fAll" },
];

function ReceiptViewer({ path }: { path: string }) {
  const { t } = useLocale();
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

  if (loading) return <p className="text-[12px] text-muted">{t("ord.receiptLoading")}</p>;
  if (!url) return <p className="text-[12px] text-[#FF6B85]">{t("ord.receiptFailed")}</p>;

  return (
    <>
      <img
        src={url}
        alt="To'lov cheki"
        onClick={() => setExpanded(true)}
        className="w-full max-h-56 object-contain rounded-lg border border-subtle cursor-zoom-in bg-black/20"
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

// 5-BOSQICH: telefon tasdiqi. Operator mijozга qo'ng'iroq qilib "shuncha
// summa qabul qildingizmi?" deб so'raganда javobни qayd qiladi (Ha/Yo'q +
// summa + izoh). Qaydlar tarix (dalil) — o'chirilmaydi. Ixtiyoriy: buyurtma
// bajarilishini bloklamaydi, alohida bo'lim.
function PhoneConfirmSection({ order, operatorNames }: { order: Order; operatorNames: Record<string, string> }) {
  const supabase = createClient();
  const { t } = useLocale();
  const [rows, setRows] = useState<{ id: string; operator_id: string | null; confirmed: boolean; amount: number | null; note: string | null; created_at: string }[]>([]);
  const [amount, setAmount] = useState(String(order.amount));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"yes" | "no" | null>(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("order_confirmations")
      .select("id, operator_id, confirmed, amount, note, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });
    setRows((data as any[]) ?? []);
  };
  useEffect(() => { load(); }, [order.id]);

  const submit = async (confirmed: boolean) => {
    setErr("");
    setSubmitting(confirmed ? "yes" : "no");
    try {
      const res = await fetch("/api/admin/telegram-orders/confirm-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, confirmed, amount: confirmed ? Number(amount) || null : null, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(data.error === "not_responsible" ? t("ord.notResponsible") : t("ord.confirmFailed"));
        return;
      }
      setNote("");
      load();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="rounded-xl glass-card p-3.5 mb-4">
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2.5">📞 {t("ord.phoneConfirm")}</div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("ord.amount")}
          className="w-36 bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px] outline-none focus:border-accent"
        />
        <span className="text-[11px] text-muted">{t("ord.receivedQ")}</span>
      </div>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("ord.noteOptional")}
        className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[12px] outline-none focus:border-accent mb-2"
      />
      {err && <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[11px] px-3 py-2 mb-2">{err}</div>}
      <div className="flex gap-2">
        <button
          onClick={() => submit(true)}
          disabled={submitting !== null}
          className="flex-1 py-2 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] font-semibold text-[12px] disabled:opacity-50"
        >
          {submitting === "yes" ? <Loader2 size={13} className="animate-spin mx-auto" /> : t("ord.yesReceived")}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={submitting !== null}
          className="flex-1 py-2 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] font-semibold text-[12px] disabled:opacity-50"
        >
          {submitting === "no" ? <Loader2 size={13} className="animate-spin mx-auto" /> : t("ord.no")}
        </button>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-subtle pt-2.5">
          {rows.map((r) => (
            <div key={r.id} className="text-[11px] text-muted">
              <span className={r.confirmed ? "text-[#4ADE80]" : "text-[#FF6B85]"}>
                {r.confirmed ? `✅ ${t("ord.yesShort")}${r.amount != null ? `, ${Number(r.amount).toLocaleString("ru-RU")} ${t("ord.sum")}` : ""}` : `❌ ${t("ord.noShort")}`}
              </span>
              {" · "}
              {r.operator_id ? (operatorNames[r.operator_id] ?? t("ord.operator")) : t("ord.operator")}
              {" · "}
              {new Date(r.created_at).toLocaleString("ru-RU")}
              {r.note ? ` · ${r.note}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResolveModal({ order, operatorNames, onClose, onDone }: { order: Order; operatorNames: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"completed" | "rejected" | null>(null);
  const [apiError, setApiError] = useState("");
  const { t } = useLocale();

  const CASHDESK_ERROR_LABELS: Record<string, string> = {
    not_configured: t("ord.cd_not_configured"),
    network_error: t("ord.cd_network"),
    request_failed: t("ord.cd_request"),
    signature_error_401: t("ord.cd_sign401"),
    signature_error_403: t("ord.cd_sign403"),
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
          setApiError(CASHDESK_ERROR_LABELS[data.detail] ?? `${t("ord.cd_error")}: ${data.detail}`);
        } else if (data.error === "reason_required") {
          setApiError(t("ord.reasonRequired"));
        } else {
          setApiError(t("ord.genericError"));
        }
        return;
      }
      onDone();
    } finally {
      setSubmitting(null);
    }
  };

  const Row = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-subtle last:border-0">
      <span className="text-[12px] text-muted shrink-0">{label}</span>
      <span className={`text-[13px] text-right ${highlight ? "font-semibold text-white" : ""}`}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <div className="w-full max-w-md rounded-2xl border border-subtle bg-panel p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-[16px]">{order.type === "topup" ? t("ord.topup") : t("ord.withdraw")}</h2>
          <button onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <div className="text-[22px] font-extrabold mb-4">{Number(order.amount).toLocaleString("ru-RU")} {t("ord.sum")}</div>

        {order.type === "withdraw" && order.payout_done && (
          <div className="rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/30 text-[#4ADE80] text-[12px] px-3 py-2.5 mb-4">
            {t("ord.payoutDone")}
          </div>
        )}

        {/* Verification checks — the things an operator must actually look at */}
        <div className="rounded-xl glass-card p-3.5 mb-4">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2.5">{t("ord.checks")}</div>

          <div className="flex items-center gap-2 mb-3">
            {order.player_name ? (
              <>
                <CheckCircle2 size={15} className="text-[#4ADE80] shrink-0" />
                <span className="text-[13px]">
                  {t("ord.player")}: <span className="font-semibold text-[#4ADE80]">{order.player_name}</span>
                  <span className="text-[10px] text-[#5b6f85] ml-1">{t("ord.verifiedApi")}</span>
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={15} className="text-[#F4C76A] shrink-0" />
                <span className="text-[13px] text-[#F4C76A]">{t("ord.playerUnverified")}</span>
              </>
            )}
          </div>

          {order.type === "topup" && (
            <div className="mb-3 rounded-lg bg-accent/10 border border-accent/25 px-3 py-2.5">
              <div className="text-[11px] text-accent font-semibold mb-1">{t("ord.paymentPlace")}</div>
              {order.received_account_number ? (
                <div className="text-[13px]">
                  <span className="font-semibold">{order.received_account_number}</span>
                  {order.received_holder_name && <span className="text-muted"> — {order.received_holder_name}</span>}
                  <div className="text-[11px] text-muted mt-0.5">
                    {t("ord.operator")}: <span className="font-semibold text-white">
                      {order.payment_operator_id ? (operatorNames[order.payment_operator_id] ?? t("ord.unknown")) : t("ord.unknown")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[#F4C76A]">{t("ord.notRecorded")}</p>
              )}
            </div>
          )}

          {order.type === "topup" && (
            <div>
              <div className="text-[12px] text-muted mb-1.5">{t("ord.receipt")}</div>
              {order.receipt_path ? (
                <ReceiptViewer path={order.receipt_path} />
              ) : (
                <p className="text-[12px] text-[#FF6B85]">{t("ord.noReceipt")}</p>
              )}
            </div>
          )}

          {order.type === "withdraw" && (
            <div className="flex items-center gap-2">
              <UserCheck size={15} className="text-accent shrink-0" />
              <span className="text-[13px]">
                {t("ord.recipient")}: <span className="font-semibold">{order.recipient_name || "—"}</span>
              </span>
            </div>
          )}
        </div>

        {/* Order details */}
        <div className="rounded-xl glass-card p-3.5 mb-4">
          <Row label={t("ord.customer")} value={order.customers?.full_name || order.customers?.phone || "—"} />
          <Row label={t("ord.platform")} value={order.platform} />
          <Row label={t("ord.accountId")} value={order.account_id} />
          <Row label={t("ord.method")} value={order.payment_method} />
          {order.withdraw_code && <Row label={t("ord.withdrawCode")} value={order.withdraw_code} highlight />}
          {order.payout_details && <Row label={t("ord.recipientNum")} value={order.payout_details} highlight />}
        </div>

        {/* 5-BOSQICH: telefon tasdiqi — pending va hal qilingan buyurtmalar uchun ham (dalil) */}
        <PhoneConfirmSection order={order} operatorNames={operatorNames} />

        {order.status === "pending" ? (
        <>
        <div className="flex gap-1.5 mb-2 overflow-x-auto min-w-0">
          {REJECT_REASON_KEYS.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setNote(t(tpl as any))}
              className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-full bg-white/5 border border-subtle text-muted hover:text-white hover:border-accent/40 whitespace-nowrap"
            >
              {t(tpl as any)}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent mb-3"
          placeholder={t("ord.rejPlaceholder")}
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
            disabled={submitting !== null || !note.trim()}
            title={!note.trim() ? t("ord.rejReasonHint") : undefined}
            className="flex-1 py-2.5 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] font-semibold text-[13px] disabled:opacity-50"
          >
            {submitting === "rejected" ? <Loader2 size={14} className="animate-spin mx-auto" /> : t("ord.reject")}
          </button>
          <button
            onClick={() => resolve("completed")}
            disabled={submitting !== null}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50"
          >
            {submitting === "completed" ? <Loader2 size={14} className="animate-spin mx-auto" /> : t("ord.done")}
          </button>
        </div>
        </>
        ) : (
          <div className="rounded-lg glass-card px-3.5 py-3 text-[13px]">
            <span className={`font-semibold ${order.status === "completed" ? "text-[#4ADE80]" : "text-[#FF6B85]"}`}>
              {order.status === "completed" ? t("ord.doneOrder") : t("ord.rejectedOrder")}
            </span>
            {order.operator_note && <div className="text-[12px] text-muted mt-1.5">{t("ord.note")}: {order.operator_note}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function CashdeskBalanceBadge() {
  const { t } = useLocale();
  const [state, setState] = useState<{ configured: boolean; balance?: number | null; limit?: number | null } | null>(null);

  useEffect(() => {
    fetch("/api/admin/telegram-orders/balance")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false }));
  }, []);

  if (!state || !state.configured) return null;

  return (
    <div className="mb-4 rounded-lg glass-card px-3.5 py-2.5 text-[12px] flex items-center gap-4">
      <span className="text-muted">{t("ord.cdBalance")}</span>
      <span className="font-semibold">{state.balance != null ? Number(state.balance).toLocaleString("ru-RU") : "—"}</span>
      {state.limit != null && (
        <>
          <span className="text-muted">{t("ord.limitLabel")}</span>
          <span className="font-semibold">{Number(state.limit).toLocaleString("ru-RU")}</span>
        </>
      )}
    </div>
  );
}

function LimitsEditor() {
  const { t } = useLocale();
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
    <div className="mb-4 rounded-lg glass-card px-3.5 py-3">
      <div className="text-[11px] text-muted mb-2">{t("wid.limitsTitle")}</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] text-[#5b6f85] mb-1">{t("wid.maxOrder")}</label>
          <input
            type="number"
            className="w-36 bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px]"
            value={values.max_order_amount}
            onChange={(e) => setValues((prev) => ({ ...prev, max_order_amount: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#5b6f85] mb-1">{t("wid.dailyLimit")}</label>
          <input
            type="number"
            className="w-36 bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px]"
            value={values.daily_customer_limit}
            onChange={(e) => setValues((prev) => ({ ...prev, daily_customer_limit: e.target.value }))}
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold disabled:opacity-60"
        >
          {saving ? "…" : saved ? t("wid.saved") : t("common.save")}
        </button>
        {saveError && <span className="text-[11px] text-[#FF6B85] self-center">{t("wid.saveFailed")}</span>}
      </div>
    </div>
  );
}

// 4-BOSQICH: operator band holati (is_busy + sabab). is_online dan alohida.
// (is_online holatini o'zgartirish endi sidebar'dagi ShellCard'ga ko'chirildi.)
// Band bo'lganда — buyurtmalari SLA/cron orqali boshqa operatorga o'tishi mumkin.
function MyBusyToggle() {
  const { t } = useLocale();
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

    const { error } = await supabase.from("profiles").update({ is_busy: next, busy_reason: nextReason || null }).eq("id", user.id);
    if (error) {
      alert(t("wid.saveFailed2") + error.message);
      setSaving(false);
      return;
    }
    await supabase.from("team_chat_messages").insert({
      sender_id: user.id,
      is_system: true,
      event_type: "status",
      message: next
        ? `⛔ ${name} ${t("wid.busyMarked")}${nextReason ? ` (${nextReason})` : ""} ${t("wid.ordersMayMove")}`
        : `✅ ${name} ${t("wid.nowFree")}`,
    });
    setIsBusy(next);
    setSaving(false);
  };

  // Yuklanayotganda HAM shu joyni band qilib turadigan skeleton — `return null`
  // butun panelni bir lahzaga yo'qotib, ma'lumot kelgach qayta chizardi
  // ("2 tugma yonib-o'chishi"). Endi tashqi konteyner doim bir xil o'lchamda.
  return (
    <div className={`mb-4 rounded-lg px-3.5 py-2.5 border ${loading ? "bg-white/[0.03] border-subtle" : isBusy ? "bg-[#FF6B85]/10 border-[#FF6B85]/25" : "bg-white/[0.02] border-subtle"}`}>
      <div className="flex items-center justify-between gap-3">
        {loading ? (
          <div className="h-[15px] w-40 rounded bg-white/10 animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isBusy ? "bg-[#FF6B85]" : "bg-[#4ADE80]"}`} />
            <span className={`text-[12px] ${isBusy ? "text-[#FF6B85]" : "text-muted"}`}>
              {t("wid.busyLabel")} <span className="font-semibold">{isBusy ? t("wid.busyMan") : t("wid.freeMan")}</span>
              {isBusy && reason ? <span className="text-[11px]"> — {reason}</span> : null}
            </span>
          </div>
        )}
        {loading ? (
          <div className="shrink-0 h-[26px] w-20 rounded-lg bg-white/10 animate-pulse" />
        ) : (
          <button
            onClick={toggle}
            disabled={saving}
            className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
          >
            {saving ? "…" : isBusy ? t("wid.markFree") : t("wid.markBusyMan")}
          </button>
        )}
      </div>
      {!loading && !isBusy && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("wid.busyReasonPh")}
          className="mt-2 w-full bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px] outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

// 6-BOSQICH: qarzlar. Operator o'z qarzlarini ko'radi (menga haq / men
// qarzdor / sof balans) va ikki tomon tasdig'i (To'ladim / Oldim). Qarz
// bo'lmasa umuman ko'rinmaydi.
function DebtsSection() {
  const { t } = useLocale();
  const [data, setData] = useState<{ me: string; debts: any[]; summary: { iOwe: number; owedToMe: number; net: number } } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/operator-debts");
      const d = await res.json();
      if (res.ok) setData(d);
    } catch {
      /* jim */
    }
  };
  useEffect(() => { load(); }, []);

  const confirm = async (debtId: string) => {
    setBusyId(debtId);
    try {
      await fetch("/api/admin/operator-debts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debtId }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const announce = async () => {
    setAnnouncing(true);
    try {
      await fetch("/api/admin/operator-debts/announce", { method: "POST" });
    } finally {
      setAnnouncing(false);
    }
  };

  if (!data || data.debts.length === 0) return null;
  const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");

  return (
    <div className="mb-4 rounded-lg glass-card px-3.5 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-semibold">💳 {t("wid.debts")}</div>
        <button onClick={announce} disabled={announcing} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50">
          {announcing ? "…" : t("wid.endShift")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] mb-2.5">
        <span className="text-[#4ADE80]">{t("wid.owedToMe")} {fmt(data.summary.owedToMe)}</span>
        <span className="text-[#FF6B85]">{t("wid.iOwe")} {fmt(data.summary.iOwe)}</span>
        <span className={data.summary.net >= 0 ? "text-[#4ADE80]" : "text-[#FF6B85]"}>{t("wid.net")} {fmt(data.summary.net)}</span>
      </div>
      <div className="space-y-1.5">
        {data.debts.map((d: any) => {
          const paid = d.status === "paid";
          const canPay = d.i_am_debtor && !d.debtor_confirmed_at && !paid;
          const canReceive = d.i_am_creditor && !d.creditor_confirmed_at && !paid;
          const statusLabel = paid
            ? t("wid.closed")
            : d.status === "debtor_confirmed"
            ? t("wid.debtorConfirmed")
            : d.status === "creditor_confirmed"
            ? t("wid.creditorConfirmed")
            : t("wid.open");
          return (
            <div key={d.id} className="flex items-center justify-between gap-2 text-[11px] border-b border-subtle pb-1.5 last:border-0">
              <div className="min-w-0">
                <span className={d.i_am_debtor ? "text-[#FF6B85]" : "text-[#4ADE80]"}>
                  {`${d.i_am_debtor ? d.creditor_name : d.debtor_name}: ${fmt(d.amount)} ${t("ord.sum")}`}
                </span>
                <span className="text-muted"> · {statusLabel}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                {canPay && (
                  <button onClick={() => confirm(d.id)} disabled={busyId === d.id} className="px-2 py-1 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] disabled:opacity-50">
                    {t("wid.iPaid")}
                  </button>
                )}
                {canReceive && (
                  <button onClick={() => confirm(d.id)} disabled={busyId === d.id} className="px-2 py-1 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] disabled:opacity-50">
                    {t("wid.iReceived")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 7-BOSQICH: operator o'z ishonch reytingini ko'radi (ixtiyoriy; asosiy
// nazorat super_admin panelida /admin/operator-rating).
function MyRatingBadge() {
  const { t } = useLocale();
  const [rating, setRating] = useState<number | null>(null);
  const supabase = createClient();
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("rating").eq("id", user.id).maybeSingle();
      if (data) setRating((data as any).rating ?? 0);
    });
  }, []);
  if (rating === null) return null;
  return (
    <div className="mb-4 rounded-lg glass-card px-3.5 py-2 text-[12px] flex items-center gap-2">
      <span className="text-muted">{t("wid.trustRating")}</span>
      <span className={`font-semibold ${rating > 0 ? "text-[#4ADE80]" : rating < 0 ? "text-[#FF6B85]" : "text-white"}`}>
        {rating > 0 ? `+${rating}` : rating}
      </span>
    </div>
  );
}

function TelegramLinkWidget() {
  const { t } = useLocale();
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
        <span>{t("wid.tgLinked")}</span>
        <button onClick={unlink} disabled={unlinking} className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-subtle text-muted hover:text-white">
          {unlinking ? "…" : t("wid.unlink")}
        </button>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="mb-4 rounded-lg glass-card px-3.5 py-2.5 text-[12px] text-muted">
        {t("wid.tgCheckFailed")}
      </div>
    );
  }

  if (linked === null) {
    return (
      <div className="mb-4 rounded-lg glass-card px-3.5 py-2.5 text-[12px] text-muted">
        Telegram ulanish holati tekshirilmoqda…
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg bg-[#F4C76A]/10 border border-[#F4C76A]/25 px-3.5 py-2.5 text-[12px] text-[#F4C76A]">
      <div className="mb-2">{t("wid.tgNotLinked")}</div>
      {code ? (
        <div className="text-white/90">
          Botga yuboring: <span className="font-mono font-bold">/link {code}</span> (10 daqiqa amal qiladi)
        </div>
      ) : (
        <button onClick={generate} disabled={generating} className="px-3 py-1.5 rounded-lg bg-[#F4C76A]/20 border border-[#F4C76A]/40 text-[11px] font-semibold">
          {generating ? "…" : t("wid.getCode")}
        </button>
      )}
    </div>
  );
}

const ORDERS_PAGE_SIZE = 100;

export function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
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
  const { t } = useLocale();
  const isSuperAdmin = profile?.roles?.key === "super_admin";

  // Qidiruv/filtr server tomonda (#16) — ilgari .limit(200) olib, qidiruv
  // va filtrlarni FAQAT shu 200 qator ustida qilardi; 200 tadan eski
  // buyurtma hech qanday filtr bilan topilmasdi.
  const load = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filter,
        page: String(p),
        onlyToday: onlyToday ? "1" : "0",
        onlyUnclaimed: onlyUnclaimed ? "1" : "0",
        operatorId: operatorFilter,
        search,
      });
      const res = await fetch(`/api/admin/telegram-orders/list?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setOrders((data.orders as any[]) ?? []);
        setTotal(data.total ?? 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Qidiruv/filtr o'zgarganda 0-sahifadan qayta yuklaymiz (customers/page.tsx
  // bilan bir xil naqsh — 300ms debounce, har tugma bosilganda emas).
  // Birinchi mount'da BU effekt ham, pastdagi [page] effekti ham ishga
  // tushardi (ikkalasi ham "yangi" deps bilan) — ya'ni har sahifa
  // ochilganda/refresh qilinganda ikkita bir xil so'rov ketardi: birinchisi
  // ro'yxatni ko'rsatardi, 300ms'dan keyin ikkinchisi `loading`ni qayta
  // true qilib ro'yxatni "Yuklanmoqda…" matiniga almashtirardi (miltillash).
  // didMountRef mount paytidagi ishga tushishni o'tkazib yuboradi.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    const tm = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, operatorFilter, onlyToday, onlyUnclaimed, search]);

  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

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
      if (!data.ok) alert(t("wid.takeoverTaken"));
    } catch {
      /* tarmoq xatosi — jim */
    } finally {
      load();
    }
  };

  const lastPage = Math.max(0, Math.ceil(total / ORDERS_PAGE_SIZE) - 1);

  return (
    <div>
      {/* Ish holati va Telegram xabarnomasi — faqat xodimlar uchun (super admin buyurtma qayta ishlamaydi) */}
      {!isSuperAdmin && <MyBusyToggle />}
      {!isSuperAdmin && <MyRatingBadge />}
      {!isSuperAdmin && <DebtsSection />}
      {!isSuperAdmin && <TelegramLinkWidget />}
      <Can permission="telegram_operators.manage"><LimitsEditor /></Can>
      <CashdeskBalanceBadge />

      {/* Minimal boshqaruv paneli: qidiruv + filtrlar */}
      <div className="rounded-xl glass-card p-3 mb-4">
        <div className="relative mb-2.5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent"
            placeholder={t("ord.searchOrders")}
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
              {t(f.labelKey as any)}
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px bg-white/10 hidden sm:block" />

          <button
            onClick={() => setOnlyToday((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${onlyToday ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"}`}
          >
            {t("ord.today")}
          </button>
          <button
            onClick={() => setOnlyUnclaimed((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${onlyUnclaimed ? "bg-accent/20 text-white" : "text-muted hover:text-white hover:bg-white/5"}`}
          >
            {t("ord.unclaimed")}
          </button>
          <select
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
            className="ml-auto bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px] outline-none focus:border-accent"
          >
            <option value="all">{t("ord.allOperators")}</option>
            {currentUserId && <option value={currentUserId}>{t("ord.onlyMine")}</option>}
            {Object.entries(operatorNames).filter(([id]) => id !== currentUserId).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-muted">{t("common.loading")}</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl glass-card p-8 text-center text-[13px] text-muted">
          {t("ord.noOrders")}
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => {
            const owner = o.status === "pending" ? o.claimed_by : o.operator_id;
            const ownerName = owner ? operatorNames[owner] : null;
            return (
              <button
                key={o.id}
                onClick={() => openOrder(o)}
                className="w-full flex items-center justify-between gap-3 rounded-xl glass-card p-4 text-left hover:border-accent/40 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold flex items-center gap-1.5">
                    {o.type === "topup" ? t("ord.topup") : t("ord.withdraw")} · {o.platform}
                    {o.auto_processed && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">API</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {o.customers?.full_name || o.customers?.phone || "—"} · {o.player_name ? `${o.player_name} (ID: ${o.account_id})` : `ID: ${o.account_id}`} · {o.payment_method}
                  </div>
                  {o.type === "topup" && o.payment_operator_id && (
                    <div className="text-[10px] text-[#F4C76A] mt-0.5">
                      💳 {operatorNames[o.payment_operator_id] ?? t("ord.unknown")} {t("ord.paidToCard")}
                    </div>
                  )}
                  {ownerName && (
                    <div className="text-[10px] text-accent mt-1">
                      {o.status === "pending" ? `🔵 ${ownerName} ${t("ord.reviewing")}` : `${ownerName} ${t("ord.didIt")}`}
                    </div>
                  )}
                  {o.status === "pending" && o.handoff_open && o.claimed_by !== currentUserId && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); takeover(o); }}
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-[#F4C76A]/15 border border-[#F4C76A]/40 text-[#F4C76A] font-semibold cursor-pointer hover:bg-[#F4C76A]/25"
                    >
                      {t("ord.takeoverBtn")}
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
                    {o.status === "pending" ? t("ord.statusPending") : o.status === "completed" ? t("ord.statusCompleted") : t("ord.statusRejected")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && total > ORDERS_PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 text-[12px]">
          <span className="text-muted">{page * ORDERS_PAGE_SIZE + 1}–{Math.min((page + 1) * ORDERS_PAGE_SIZE, total)} / {total}</span>
          <div className="flex gap-1.5">
            <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-2 rounded-lg border border-subtle disabled:opacity-30 hover:bg-white/5"><ChevronLeft size={15} /></button>
            <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className="p-2 rounded-lg border border-subtle disabled:opacity-30 hover:bg-white/5"><ChevronRight size={15} /></button>
          </div>
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

