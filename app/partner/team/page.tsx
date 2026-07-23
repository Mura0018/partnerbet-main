"use client";

import React, { useEffect, useState } from "react";
import { Users, Loader2, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function PartnerTeamPage() {
  const supabase = createClient();
  const [role, setRole] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadMembers = async () => {
    const { data } = await supabase.from("partner_members").select("id, partner_role, profiles(full_name)");
    setMembers((data as any[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: me } = await supabase.from("partner_members").select("partner_role").eq("profile_id", user.id).maybeSingle();
        setRole((me as any)?.partner_role ?? "");
      }
      await loadMembers();
      setLoading(false);
    })();
  }, []);

  const isAdmin = role === "partner_admin";

  const addStaff = async () => {
    setError("");
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 8) { setError("Barcha maydon — parol kamida 8 belgi."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/partner/create-staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password }) });
      const data = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = { email_taken: "Bu email band.", weak_password: "Parol kamida 8 belgi.", forbidden: "Ruxsatingiz yo'q." };
        setError(map[data.error] ?? "Xatolik yuz berdi."); return;
      }
      setShowAdd(false); setForm({ fullName: "", email: "", password: "" });
      loadMembers();
    } catch { setError("Ulanishda xatolik."); }
    finally { setSaving(false); }
  };

  const removeStaff = async (id: string) => {
    if (!confirm("Xodimni o'chirishni tasdiqlaysizmi?")) return;
    await supabase.from("partner_members").delete().eq("id", id);
    loadMembers();
  };

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2"><Users size={20} className="text-accent" /><h1 className="text-[22px] font-bold">Jamoa</h1></div>
        {isAdmin && <button onClick={() => { setShowAdd((v) => !v); setError(""); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"><Plus size={14} /> Xodim</button>}
      </div>
      <p className="text-[13px] text-muted mb-6">Xodimlaringiz buyurtmalarni qayta ishlaydi.</p>

      {showAdd && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4 space-y-2.5">
          <input placeholder="Ism familiya" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
          <input placeholder="Parol (kamida 8 belgi)" type="text" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
          {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
          <button onClick={addStaff} disabled={saving} className="w-full py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Yaratish"}</button>
        </div>
      )}

      <div className="space-y-1.5">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/8 px-4 py-3">
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium">{m.profiles?.full_name || "—"}</span>
              <span className="text-[10.5px] text-muted"> · {m.partner_role === "partner_admin" ? "Admin" : "Xodim"}</span>
            </div>
            {isAdmin && m.partner_role === "staff" && (
              <button onClick={() => removeStaff(m.id)} className="p-1.5 rounded hover:bg-[#FF6B85]/10 text-[#FF6B85]" aria-label="O'chirish"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
