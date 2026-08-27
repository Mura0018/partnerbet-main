"use client";

import React, { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { formatDateTime } from "@/lib/format";
import { CreditCard, Loader2, Plus, Download } from "lucide-react";

type Batch = {
  id: string;
  label: string;
  quantity: number;
  note: string | null;
  created_at: string;
  counts: { blank: number; assigned: number; cancelled: number };
};

export default function CardsPage() {
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cards/batches");
      const d = await res.json();
      if (res.ok) setBatches(d.batches ?? []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr("");
    const qty = Math.floor(Number(quantity));
    if (!label.trim()) { setErr(t("crd.errLabel")); return; }
    if (!Number.isFinite(qty) || qty < 1 || qty > 5000) { setErr(t("crd.errQty")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cards/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), quantity: qty, note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error === "code_conflict_retry" ? t("crd.errConflict") : d.error === "invalid_quantity" ? t("crd.errQty") : d.error === "label_required" ? t("crd.errLabel") : t("crd.errGeneric"));
        return;
      }
      setLabel(""); setQuantity(""); setNote("");
      load();
    } catch {
      setErr(t("crd.errGeneric"));
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async (batch: Batch) => {
    setExportingId(batch.id);
    try {
      const res = await fetch(`/api/admin/cards/batches/${batch.id}/codes`);
      const d = await res.json();
      if (!res.ok) return;
      const codes: { code: string }[] = d.codes ?? [];
      // Tipografiya uchun IZOH — QR aynan xom kodni kodlashi kerak.
      const lines: string[] = [];
      lines.push("# BetCore Pay — QR karta kodlari");
      lines.push(`# Partiya: ${batch.label} (${codes.length} dona)`);
      lines.push("# MUHIM: QR kod AYNAN 'code' ustunidagi XOM kodni kodlashi kerak —");
      lines.push("#        AJRATGICHSIZ, o'zgartirishsiz, katta harflarda.");
      lines.push("#        Kartada ko'rish uchun guruhlash mumkin (masalan CP-XXXX-XXXX-XX),");
      lines.push("#        lekin QR faqat xom kodni o'z ichiga olsin.");
      lines.push("code");
      for (const c of codes) lines.push(c.code);
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kartalar-${batch.label.replace(/[^a-zA-Z0-9-]+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><CreditCard size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("crd.title")}</h1>
          <p className="text-xs text-white/40">{t("crd.subtitle")}</p>
        </div>
      </div>

      {/* Yangi partiya */}
      <div className="rounded-2xl glass-card p-4 mb-5">
        <div className="text-[13px] font-semibold text-white mb-3 flex items-center gap-1.5"><Plus size={15} /> {t("crd.create")}</div>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] text-white/50 mb-1">{t("crd.label")}</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("crd.labelPh")}
              className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-white text-[13px] outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-[11px] text-white/50 mb-1">{t("crd.quantity")}</label>
            <input type="number" min={1} max={5000} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100"
              className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-white text-[13px] outline-none focus:border-accent" />
          </div>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("crd.note")}
          className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-white text-[13px] outline-none focus:border-accent mb-2.5" />
        {err && <div className="rounded-lg bg-[#FF6B85]/10 border border-[#FF6B85]/30 text-[#FF6B85] text-[12px] px-3 py-2 mb-2.5">{err}</div>}
        <button onClick={create} disabled={saving}
          className="w-full py-2.5 rounded-lg bg-[#1CE0C3] text-[#04231F] font-semibold text-[13px] disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={15} className="animate-spin" /> {t("crd.generating")}</> : t("crd.generate")}
        </button>
      </div>

      {/* Partiyalar */}
      <div className="text-[13px] font-semibold text-white/70 mb-2">{t("crd.batches")}</div>
      {loading ? (
        <div className="py-10 text-center"><Loader2 size={20} className="animate-spin text-muted mx-auto" /></div>
      ) : batches.length === 0 ? (
        <div className="text-[12px] text-white/30 py-6 text-center">{t("crd.noBatches")}</div>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <div key={b.id} className="rounded-xl glass-card p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold text-[13.5px] truncate">{b.label}</div>
                <div className="text-[11px] text-white/40 mt-0.5">
                  {b.quantity} {t("crd.qty")} · {formatDateTime(b.created_at, { timeZone: tz })}
                  {b.note ? ` · ${b.note}` : ""}
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-2.5">
                  <span className="text-[#2E8FFF]">{b.counts.blank} {t("crd.blankCount")}</span>
                  <span className="text-[#4ADE80]">{b.counts.assigned} {t("crd.assignedCount")}</span>
                  <span className="text-[#FF6B85]">{b.counts.cancelled} {t("crd.cancelledCount")}</span>
                </div>
              </div>
              <button onClick={() => exportCsv(b)} disabled={exportingId === b.id}
                className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-subtle text-white text-[12px] font-medium hover:bg-white/10 disabled:opacity-50 flex items-center gap-1.5">
                {exportingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t("crd.export")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
