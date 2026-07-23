"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Insight = {
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  match_time: string;
  expected_goals: string;
  possession_trend: string;
  confidence: number;
  analysis: string;
  status: string;
};

const EMPTY: Omit<Insight, "id"> = {
  league: "", home_team: "", away_team: "", match_time: "",
  expected_goals: "", possession_trend: "", confidence: 50, analysis: "", status: "UPCOMING",
};

export default function InsightsManager() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [form, setForm] = useState<Omit<Insight, "id">>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("match_insights")
      .select("*")
      .is("deleted_at", null)
      .order("match_time", { ascending: false });
    setInsights((data as Insight[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); };
  const openEdit = (i: Insight) => {
    const { id, ...rest } = i;
    setForm(rest); setEditingId(id); setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await supabase.from("match_insights").update(form).eq("id", editingId);
    } else {
      await supabase.from("match_insights").insert(form);
    }
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    // Soft delete: keeps the row (and its audit history) instead of erasing it.
    await supabase.from("match_insights").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold">Match Insights</h1>
          <p className="text-[13px] text-muted mt-1">Kod yozmasdan match tahlillarini qo'shing va tahrirlang.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Yangi insight
        </button>
      </div>

      {loading && <p className="text-[13px] text-muted">Yuklanmoqda…</p>}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((i) => (
          <div key={i.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">{i.league}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(i)} className="p-1.5 rounded-md hover:bg-white/10"><Pencil size={13} /></button>
                <button onClick={() => remove(i.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="font-semibold text-[14px]">{i.home_team} vs {i.away_team}</div>
            <div className="text-[11px] text-[#5b6f85] mt-1">{new Date(i.match_time).toLocaleString()} · Conf. {i.confidence}%</div>
            <p className="text-[12px] text-muted mt-2 line-clamp-2">{i.analysis}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
          <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-white/10 bg-panel p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px]">{editingId ? "Insightni tahrirlash" : "Yangi insight"}</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Yopish"><X size={18} /></button>
            </div>

            {[
              { key: "league", label: "Liga", type: "text" },
              { key: "home_team", label: "Uy egasi jamoa", type: "text" },
              { key: "away_team", label: "Mehmon jamoa", type: "text" },
              { key: "match_time", label: "Match vaqti", type: "datetime-local" },
              { key: "expected_goals", label: "xG (masalan 2.1 – 1.4)", type: "text" },
              { key: "possession_trend", label: "Possession (masalan 58% / 42%)", type: "text" },
            ].map((f) => (
              <div key={f.key} className="mb-3">
                <label className="block text-[12px] text-muted mb-1">{f.label}</label>
                <input
                  type={f.type} required
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
                />
              </div>
            ))}

            <div className="mb-3">
              <label className="block text-[12px] text-muted mb-1">Ishonch darajasi: {form.confidence}%</label>
              <input
                type="range" min={0} max={100}
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[12px] text-muted mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px]"
              >
                {["UPCOMING", "LIVE", "WIN", "LOST", "PUSH"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-[12px] text-muted mb-1">Tahlil matni</label>
              <textarea
                required rows={3}
                value={form.analysis}
                onChange={(e) => setForm({ ...form, analysis: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
              />
            </div>

            <button type="submit" className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px]">
              Saqlash
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
