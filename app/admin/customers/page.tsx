"use client";

import React, { useEffect, useState } from "react";
import { Users, Search, X, Loader2, ChevronLeft, ChevronRight, Gift, EyeOff, Eye, RotateCcw } from "lucide-react";
import { toast } from "@/lib/ui/toast";

type Row = { id: string; full_name: string | null; phone: string; created_at: string; partnerName: string | null; orderCount: number };
type Partner = { id: string; name: string };
type Order = { id: string; type: string; amount: number; status: string; platform: string; created_at: string };
type Detail = { customer: { id: string; full_name: string | null; phone: string; created_at: string; telegram_id: number | null; partnerName: string | null; ownerName: string | null }; orders: Order[] };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "text-[#F4C76A]" },
  completed: { label: "Bajarildi", cls: "text-[#4ADE80]" },
  rejected: { label: "Rad etildi", cls: "text-[#FF6B85]" },
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU");
const fmtSum = (n: number) => Number(n || 0).toLocaleString("ru-RU");

export default function CustomersManager() {
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ search, partnerId, page: String(p), hidden: showHidden ? "1" : "0" });
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
    const t = setTimeout(() => { setPage(0); load(0); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, partnerId, showHidden]);

  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ customer: { id, full_name: null, phone: "", created_at: "", telegram_id: null, partnerName: null, ownerName: null }, orders: [] });
    try {
      const res = await fetch(`/api/admin/customers/detail?id=${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  const toggleSelect = (id: string) => setSelectedIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const toggleAll = () => setSelectedIds(() => (allSelected ? new Set<string>() : new Set(rows.map((r) => r.id))));

  const applyHide = async (hidden: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (hidden && !confirm(`${ids.length} ta mijoz ro'yxatdan yashiriladi. Ular bazadan o'chmaydi, keyin qaytarish mumkin. Davom etasizmi?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, hidden }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Bajarilmadi: " + (data.error ?? "xatolik")); return; }
      toast.success(hidden ? `${data.updated} ta mijoz yashirildi` : `${data.updated} ta mijoz qaytarildi`);
      load(page);
    } catch { toast.error("Ulanishda xatolik."); }
    finally { setBusy(false); }
  };

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Mijozlar</h1>
        <span className="text-[12px] text-muted">({total})</span>
      </div>
      <p className="text-[13px] text-muted mb-5">Barcha mijozlar — qidiruv, hamkor filtri va batafsil ko'rish.</p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki telefon bo'yicha qidirish..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent" />
        </div>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent">
          <option value="all">Barcha mijozlar</option>
          <option value="platform">Platforma (biz)</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowHidden((v) => !v)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium border whitespace-nowrap ${showHidden ? "bg-accent/15 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted hover:text-white"}`}>
          {showHidden ? <><Eye size={14} /> Oddiy ro'yxat</> : <><EyeOff size={14} /> Yashirilganlar</>}
        </button>
      </div>

      {/* Bulk amal paneli */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5">
          <span className="text-[13px] font-medium">{selectedIds.size} ta tanlandi</span>
          {showHidden ? (
            <button onClick={() => applyHide(false)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4ADE80]/15 border border-[#4ADE80]/40 text-[#4ADE80] text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} {selectedIds.size} ta mijozni qaytarish
            </button>
          ) : (
            <button onClick={() => applyHide(true)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF6B85]/15 border border-[#FF6B85]/40 text-[#FF6B85] text-[12.5px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} {selectedIds.size} ta mijozni yashirish
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" aria-label="Hammasini tanlash" /></th>
              <th className="text-left px-4 py-3 font-medium">Ism</th>
              <th className="text-left px-4 py-3 font-medium">Telefon</th>
              <th className="text-left px-4 py-3 font-medium">Tegishli</th>
              <th className="text-right px-4 py-3 font-medium">Buyurtma</th>
              <th className="text-left px-4 py-3 font-medium">Ro'yxatdan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Yuklanmoqda...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Mijoz topilmadi.</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} onClick={() => openDetail(c.id)} className="cursor-pointer hover:bg-white/[0.03]">
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="accent-accent" aria-label="Tanlash" />
                </td>
                <td className="px-4 py-3 font-medium">{c.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted">{c.phone}</td>
                <td className="px-4 py-3">
                  {c.partnerName ? <span className="text-[#7db8ff]">{c.partnerName}</span> : <span className="text-muted">Platforma</span>}
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
            <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-2 rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronLeft size={15} /></button>
            <span className="px-2 text-muted">{page + 1} / {lastPage + 1}</span>
            <button disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className="p-2 rounded-lg border border-white/10 disabled:opacity-30 hover:bg-white/5"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Batafsil modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px]">Mijoz</h2>
              <button onClick={() => setDetail(null)} aria-label="Yopish"><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div className="py-8 text-center"><Loader2 size={20} className="animate-spin text-muted mx-auto" /></div>
            ) : (
              <>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-4">
                  <div className="text-[16px] font-bold">{detail.customer.full_name || "—"}</div>
                  <div className="text-[13px] text-muted mt-0.5">{detail.customer.phone}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-muted">
                    <span>Tegishli: <span className="text-white">{detail.customer.partnerName || "Platforma"}</span></span>
                    <span>Egasi: <span className="text-white">{detail.customer.ownerName || "biriktirilmagan"}</span></span>
                    <span>Ro'yxatdan: <span className="text-white">{detail.customer.created_at ? fmtDate(detail.customer.created_at) : "—"}</span></span>
                    {detail.customer.telegram_id != null && <span>Telegram ID: <span className="text-white font-mono">{detail.customer.telegram_id}</span></span>}
                  </div>
                </div>

                {/* BONUS uchun joy — hozir funksiya YO'Q, keyingi bosqichda qo'shiladi */}
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 mb-4 flex items-center gap-3">
                  <Gift size={18} className="text-[#F4C76A] shrink-0" />
                  <div className="text-[12px] text-muted">
                    <span className="text-white font-medium">Bonus</span> — bonus berish tugmasi shu yerga qo'shiladi (keyingi bosqich).
                  </div>
                </div>

                <div className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-2">Buyurtma tarixi ({detail.orders.length})</div>
                {detail.orders.length === 0 ? (
                  <p className="text-[13px] text-muted">Buyurtma yo'q.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.orders.map((o) => {
                      const st = STATUS[o.status] ?? STATUS.pending;
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] border border-white/8 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-medium">{o.type === "topup" ? "Hisob to'ldirish" : "Pul yechish"} · {o.platform}</div>
                            <div className="text-[10.5px] text-[#5b6f85]">{fmtDate(o.created_at)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[13px] font-bold">{fmtSum(o.amount)}</div>
                            <div className={`text-[11px] font-medium ${st.cls}`}>{st.label}</div>
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
    </div>
  );
}
