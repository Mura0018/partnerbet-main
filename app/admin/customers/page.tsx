"use client";

import React, { useEffect, useState } from "react";
import { Users, Search, X, Loader2, ChevronLeft, ChevronRight, Gift, EyeOff, Eye, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Select } from "@/lib/ui/Select";
import { useConfirm } from "@/lib/ui/useConfirm";

type Row = { id: string; full_name: string | null; phone: string; created_at: string; partnerName: string | null; orderCount: number; nameMismatchPending: boolean };
type Partner = { id: string; name: string };
type Order = { id: string; type: string; amount: number; status: string; platform: string; created_at: string };
// W1.4: nameMismatch — hali hal qilinmagan ism-nomuvofiqlik (bo'lsa); nameOverride — avval tasdiqlangan bo'lsa tarixi.
type Detail = {
  customer: {
    id: string; full_name: string | null; phone: string; created_at: string; telegram_id: number | null;
    partnerName: string | null; ownerName: string | null;
    nameMismatch: { id: string; registered_name: string; player_name: string; platform: string | null; account_id: string | null; created_at: string } | null;
    nameOverride: { by: string | null; at: string; reason: string | null } | null;
  };
  orders: Order[];
};

const STATUS: Record<string, { labelKey: string; cls: string }> = {
  pending: { labelKey: "cus.stPending", cls: "text-[#F4C76A]" },
  completed: { labelKey: "cus.stCompleted", cls: "text-[#4ADE80]" },
  rejected: { labelKey: "cus.stRejected", cls: "text-[#FF6B85]" },
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU");
const fmtSum = (n: number) => Number(n || 0).toLocaleString("ru-RU");

export default function CustomersManager() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("all");
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showHidden, setShowHidden] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const [nameMismatchFilter, setNameMismatchFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // W1.4: sabab (majburiy) + yuborilmoqda holati — "Ismni tasdiqlash" uchun.
  const [nameConfirmReason, setNameConfirmReason] = useState("");
  const [confirmingName, setConfirmingName] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ search, partnerId, page: String(p), hidden: showHidden ? "1" : "0", nameMismatch: nameMismatchFilter ? "1" : "0" });
      const res = await fetch(`/api/admin/customers?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.customers ?? []);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? 50);
        if (data.partners) setPartners(data.partners);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Qidiruv/filtr/yashiringan-rejim o'zgarganda 0-sahifadan qayta yuklaymiz.
  useEffect(() => {
    const tm = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, partnerId, showHidden, nameMismatchFilter]);

  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setNameConfirmReason("");
    setDetail({ customer: { id, full_name: null, phone: "", created_at: "", telegram_id: null, partnerName: null, ownerName: null, nameMismatch: null, nameOverride: null }, orders: [] });
    try {
      const res = await fetch(`/api/admin/customers/detail?id=${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  // W1.4: "Ismni tasdiqlash" — sabab MAJBURIY (kim/qachon serverda, auth'dan yoziladi).
  const confirmNameMismatch = async () => {
    if (!detail || !nameConfirmReason.trim()) { toast.error(t("cus.reasonRequired")); return; }
    setConfirmingName(true);
    try {
      const res = await fetch("/api/admin/customers/name-mismatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: detail.customer.id, reason: nameConfirmReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { console.error("[customers] tasdiqlanmadi:", data.error); toast.error(t("cus.tConfirmFailed")); return; }
      toast.success(t("cus.tConfirmed"));
      setNameConfirmReason("");
      await openDetail(detail.customer.id);
      load(page);
    } catch { toast.error(t("cus.tConnErr")); }
    finally { setConfirmingName(false); }
  };

  const toggleSelect = (id: string) => setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAll = () => setSelectedIds(() => (allSelected ? new Set<string>() : new Set(rows.map((r) => r.id))));

  const applyHide = (hidden: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const run = async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/admin/customers/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, hidden }) });
        const data = await res.json();
        if (!res.ok) { console.error("[customers] bajarilmadi:", data.error); toast.error(t("cus.tFailed")); return; }
        toast.success(hidden ? t("cus.tHidden", { n: data.updated }) : t("cus.tRestored", { n: data.updated }));
        load(page);
      } catch { toast.error(t("cus.tConnErr")); }
      finally { setBusy(false); }
    };
    if (hidden) confirm(t("cus.confirmHide", { n: ids.length }), run);
    else run();
  };

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">{t("cus.title")}</h1>
        <span className="text-[12px] text-muted">({total})</span>
      </div>
      <p className="text-[13px] text-muted mb-5">{t("cus.sub")}</p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("cus.searchPh")}
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent" />
        </div>
        <Select
          value={partnerId}
          onChange={setPartnerId}
          className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
          options={[
            { value: "all", label: t("cus.allCustomers") },
            { value: "platform", label: t("cus.platform") },
            ...partners.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <button onClick={() => setShowHidden((v) => !v)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border whitespace-nowrap ${showHidden ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted hover:text-white"}`}>
          {showHidden ? <><Eye size={14} /> {t("cus.normalList")}</> : <><EyeOff size={14} /> {t("cus.hiddenList")}</>}
        </button>
        <button onClick={() => setNameMismatchFilter((v) => !v)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border whitespace-nowrap ${nameMismatchFilter ? "bg-[#F4C76A]/15 border-[#F4C76A]/50 text-[#F4C76A]" : "bg-white/[0.02] border-subtle text-muted hover:text-white"}`}>
          <AlertTriangle size={14} /> {t("cus.nameMismatchFilter")}
        </button>
      </div>

      {/* Bulk amal paneli */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5">
          <span className="text-[13px] font-medium">{t("cus.selected", { n: selectedIds.size })}</span>
          {showHidden ? (
            <button onClick={() => applyHide(false)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} {t("cus.restoreN", { n: selectedIds.size })}
            </button>
          ) : (
            <button onClick={() => applyHide(true)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} {t("cus.hideN", { n: selectedIds.size })}
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-subtle overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" aria-label={t("cus.selectAll")} /></th>
              <th className="text-left px-4 py-3 font-medium">{t("cus.colName")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("cus.colPhone")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("cus.colBelongs")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("cus.colOrders")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("cus.colRegistered")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">{t("cus.loading")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">{t("cus.notFound")}</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} onClick={() => openDetail(c.id)} className="cursor-pointer hover:bg-white/[0.03]">
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="accent-accent" aria-label={t("cus.selectOne")} />
                </td>
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {c.full_name || "—"}
                    {c.nameMismatchPending && (
                      <span title={t("cus.nameMismatchBadge")} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F4C76A]/15 text-[#F4C76A]">
                        <AlertTriangle size={10} /> {t("cus.nameMismatchBadge")}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{c.phone}</td>
                <td className="px-4 py-3">
                  {c.partnerName ? <span className="text-[#7db8ff]">{c.partnerName}</span> : <span className="text-muted">{t("cus.platformShort")}</span>}
                </td>
                <td className="px-4 py-3 text-right">{c.orderCount}</td>
                <td className="px-4 py-3 text-[#5b6f85]">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sahifalash */}
      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-[13px]">
          <span className="text-muted">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total}</span>
          <div className="flex items-center gap-1.5">
            <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-2 rounded-lg border border-subtle disabled:opacity-30 hover:bg-white/5"><ChevronLeft size={15} /></button>
            <span className="px-2 text-muted">{page + 1} / {lastPage + 1}</span>
            <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className="p-2 rounded-lg border border-subtle disabled:opacity-30 hover:bg-white/5"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Batafsil modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-subtle bg-panel p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px]">{t("cus.modalTitle")}</h2>
              <button onClick={() => setDetail(null)} aria-label={t("cus.close")}><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div className="py-8 text-center"><Loader2 size={20} className="animate-spin text-muted mx-auto" /></div>
            ) : (
              <>
                <div className="rounded-xl glass-card p-4 mb-4">
                  <div className="text-[16px] font-bold">{detail.customer.full_name || "—"}</div>
                  <div className="text-[13px] text-muted mt-0.5">{detail.customer.phone}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-muted">
                    <span>{t("cus.belongs")} <span className="text-white">{detail.customer.partnerName || t("cus.platformShort")}</span></span>
                    <span>{t("cus.owner")} <span className="text-white">{detail.customer.ownerName || t("cus.notAssigned")}</span></span>
                    <span>{t("cus.registered")} <span className="text-white">{detail.customer.created_at ? fmtDate(detail.customer.created_at) : "—"}</span></span>
                    {detail.customer.telegram_id != null && <span>{t("cus.tgId")} <span className="text-white font-mono">{detail.customer.telegram_id}</span></span>}
                  </div>
                </div>

                {/* W1.4: ism mos kelmagani sababli bloklangan — operator qo'lda tasdiqlaydi (sabab majburiy). */}
                {detail.customer.nameMismatch && (
                  <div className="rounded-xl border border-[#F4C76A]/40 bg-[#F4C76A]/10 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2.5 text-[#F4C76A]">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span className="font-semibold text-[13px]">{t("cus.nameMismatchTitle")}</span>
                    </div>
                    <div className="text-[12px] text-white/90 mb-1">
                      {t("cus.registeredName")}: <span className="font-semibold">{detail.customer.nameMismatch.registered_name || "—"}</span>
                    </div>
                    <div className="text-[12px] text-white/90 mb-3">
                      {t("cus.playerNameLab")}: <span className="font-semibold">{detail.customer.nameMismatch.player_name}</span>
                    </div>
                    <textarea
                      rows={2}
                      value={nameConfirmReason}
                      onChange={(e) => setNameConfirmReason(e.target.value)}
                      placeholder={t("cus.reasonPh")}
                      className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[12px] outline-none focus:border-accent mb-2.5"
                    />
                    <button
                      onClick={confirmNameMismatch}
                      disabled={confirmingName || !nameConfirmReason.trim()}
                      className="w-full py-2 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] font-semibold text-[12.5px] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {confirmingName ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("cus.confirmName")}
                    </button>
                  </div>
                )}

                {detail.customer.nameOverride && (
                  <div className="rounded-xl border border-[#4ADE80]/30 bg-[#4ADE80]/10 p-3.5 mb-4 text-[12px] text-[#4ADE80]">
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      <CheckCircle2 size={14} /> {t("cus.nameOverridden")} — {fmtDate(detail.customer.nameOverride.at)}
                      {detail.customer.nameOverride.by && <span> ({t("cus.nameOverriddenBy")}: {detail.customer.nameOverride.by})</span>}
                    </div>
                    {detail.customer.nameOverride.reason && <div className="text-white/80">{detail.customer.nameOverride.reason}</div>}
                  </div>
                )}

                {/* BONUS uchun joy — hozir funksiya YO'Q, keyingi bosqichda qo'shiladi */}
                <div className="rounded-xl border border-dashed border-subtle bg-white/[0.02] p-4 mb-4 flex items-center gap-3">
                  <Gift size={18} className="text-[#F4C76A] shrink-0" />
                  <div className="text-[12px] text-muted">
                    <span className="text-white font-medium">{t("cus.bonusTitle")}</span> {t("cus.bonusHint")}
                  </div>
                </div>

                <div className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-2">{t("cus.orderHistory")} ({detail.orders.length})</div>
                {detail.orders.length === 0 ? (
                  <p className="text-[13px] text-muted">{t("cus.noOrders")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.orders.map((o) => {
                      const st = STATUS[o.status] ?? STATUS.pending;
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg glass-card px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium">{o.type === "topup" ? t("cus.topupLabel") : t("cus.withdrawLabel")} · {o.platform}</div>
                            <div className="text-[10.5px] text-[#5b6f85]">{fmtDate(o.created_at)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[13px] font-bold">{fmtSum(o.amount)}</div>
                            <div className={`text-[11px] font-medium ${st.cls}`}>{t(st.labelKey as any)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
