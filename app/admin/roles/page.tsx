"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Lock, Plus, X, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";

type Role = { id: string; key: string; name: string };
type Perm = { id: string; key: string; description: string | null };

const CATEGORIES: { label: string; keys: string[] }[] = [
  { label: "Kontent", keys: ["posts.manage", "football.manage", "football_news.manage", "match_insights.manage", "media.manage", "taxonomy.manage", "faqs.manage"] },
  { label: "Marketing", keys: ["advertisements.manage", "promotions.manage", "donations.manage", "streaming.manage", "navigation.manage"] },
  { label: "BetCore Pay", keys: ["telegram_orders.manage", "telegram_operators.manage", "support.manage", "team_chat.use"] },
  { label: "Hamkorlik", keys: ["partners.manage"] },
  { label: "Tizim", keys: ["users.manage", "roles.manage", "settings.manage", "logs.view", "apk.manage"] },
];

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roles/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, name }) });
      const data = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = { key_taken: "Bu kalit band.", invalid_key: "Kalit: kichik harf/raqam/pastki chiziq (a-z, 0-9, _).", forbidden: "Ruxsatingiz yo'q." };
        setError(map[data.error] ?? "Xatolik yuz berdi.");
        return;
      }
      toast.success("Rol yaratildi ✅");
      onCreated();
      onClose();
    } catch {
      setError("Ulanishda xatolik.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">Yangi rol</h2>
          <button type="button" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <label className="block text-[12px] text-muted mb-1">Kalit (masalan <span className="font-mono">support_lead</span>)</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="kichik_harf_kalit" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent mb-3 font-mono" />
        <label className="block text-[12px] text-muted mb-1">Nomi</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support boshlig'i" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent mb-4" />
        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}
        <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Yaratish"}
        </button>
        <p className="text-[11px] text-muted mt-3">Yaratilgach ruxsatlarni toggle bilan bering. Tizim rollari (super_admin/admin...) o'zgartirilmaydi.</p>
      </form>
    </div>
  );
}

export default function RolesManager() {
  const supabase = createClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [assign, setAssign] = useState<Record<string, Set<string>>>({}); // roleId -> set(permissionId)
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: p }, { data: rp }] = await Promise.all([
      supabase.from("roles").select("id, key, name").order("key"),
      supabase.from("permissions").select("id, key, description").order("key"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    setRoles((r as Role[]) ?? []);
    setPerms((p as Perm[]) ?? []);
    const m: Record<string, Set<string>> = {};
    for (const row of ((rp as any[]) ?? [])) {
      (m[row.role_id] ??= new Set()).add(row.permission_id);
    }
    setAssign(m);
    setSelected((cur) => cur ?? ((r as Role[]) ?? []).find((x) => x.key !== "super_admin")?.id ?? ((r as Role[]) ?? [])[0]?.id ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const permByKey = useMemo(() => { const m: Record<string, Perm> = {}; for (const p of perms) m[p.key] = p; return m; }, [perms]);
  const grouped = useMemo(() => {
    const used = new Set<string>();
    const groups = CATEGORIES.map((c) => ({ label: c.label, items: c.keys.map((k) => permByKey[k]).filter(Boolean) as Perm[] }));
    groups.forEach((g) => g.items.forEach((p) => used.add(p.key)));
    const others = perms.filter((p) => !used.has(p.key));
    if (others.length) groups.push({ label: "Boshqa", items: others });
    return groups.filter((g) => g.items.length);
  }, [perms, permByKey]);

  const role = roles.find((x) => x.id === selected) ?? null;
  const isSuper = role?.key === "super_admin";
  const roleSet = (selected && assign[selected]) || new Set<string>();

  const toggle = async (permId: string) => {
    if (!selected || isSuper) return;
    const has = roleSet.has(permId);
    const next = !has;
    // optimistik
    setAssign((prev) => {
      const copy = { ...prev };
      const s = new Set(copy[selected] ?? []);
      if (next) s.add(permId); else s.delete(permId);
      copy[selected] = s;
      return copy;
    });
    const res = await fetch("/api/admin/roles/toggle-permission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: selected, permissionId: permId, enabled: next }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const map: Record<string, string> = {
        protected_role: "super_admin roli himoyalangan.",
        cannot_edit_own_role: "O'z rolingizni o'zgartira olmaysiz.",
        cannot_grant_missing_permission: "O'zingizda yo'q ruxsatni bera olmaysiz.",
        forbidden: "Ruxsatingiz yo'q.",
      };
      toast.error(map[data.error] ?? "Saqlanmadi.");
      // revert
      setAssign((prev) => {
        const copy = { ...prev };
        const s = new Set(copy[selected] ?? []);
        if (next) s.delete(permId); else s.add(permId);
        copy[selected] = s;
        return copy;
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-accent" />
          <h1 className="text-[22px] font-bold">Rollar va ruxsatlar</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> Yangi rol
        </button>
      </div>
      <p className="text-[13px] text-muted mb-6">Har rolga ruxsatlarni yoqing/o'chiring. super_admin himoyalangan (hamma ruxsat).</p>

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : (
        <>
          {/* Rol tanlash */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setSelected(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors ${selected === r.id ? "bg-accent/20 border-accent text-white" : "bg-white/[0.02] border-white/10 text-muted hover:text-white"}`}>
                {r.name}{r.key === "super_admin" && <Lock size={11} className="inline ml-1 -mt-0.5" />}
              </button>
            ))}
          </div>

          {isSuper && (
            <div className="rounded-xl border border-[#F4C76A]/30 bg-[#F4C76A]/10 p-4 mb-4 text-[13px] flex items-start gap-2.5">
              <Lock size={16} className="text-[#F4C76A] shrink-0 mt-0.5" />
              <span className="text-[#F4C76A]"><b>super_admin</b> — barcha ruxsatlar, himoyalangan. Qulflab qo'ymaslik uchun bu rol o'zgartirilmaydi.</span>
            </div>
          )}

          {/* Ruxsat matritsasi */}
          <div className="space-y-5">
            {grouped.map((g) => (
              <div key={g.label}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#5b6f85] mb-2">{g.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {g.items.map((p) => {
                    const checked = isSuper ? true : roleSet.has(p.id);
                    return (
                      <label key={p.id} className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 ${isSuper ? "opacity-70 cursor-not-allowed border-white/8 bg-white/[0.02]" : "cursor-pointer border-white/8 bg-white/[0.02] hover:border-accent/40"}`}>
                        <input type="checkbox" checked={checked} disabled={isSuper} onChange={() => toggle(p.id)} className="accent-accent mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium font-mono">{p.key}</div>
                          {p.description && <div className="text-[11px] text-muted">{p.description}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
