"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Pencil, Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useCurrentProfile } from "@/lib/auth/permissions";

type Role = { id: string; key: string; name: string };
type UserRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  role_id: string;
  created_at: string;
  last_login_at: string | null;
};

function NameCell({ user, onSaved }: { user: UserRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(user.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ full_name: value.trim() || null }).eq("id", user.id);
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  if (!editing) {
    return (
      <button onClick={() => { setValue(user.full_name ?? ""); setEditing(true); }} className="flex items-center gap-1.5 group">
        <span>{user.full_name || "—"}</span>
        <Pencil size={11} className="text-[#5b6f85] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        className="bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[12px] w-36"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Ism familiya"
      />
      <button onClick={save} disabled={saving} className="p-1 rounded-md hover:bg-white/10 text-[#4ADE80]">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button onClick={() => setEditing(false)} className="p-1 rounded-md hover:bg-white/10 text-[#5b6f85]">
        <X size={13} />
      </button>
    </div>
  );
}

function CreateUserModal({ roles, onClose, onCreated }: { roles: Role[]; onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.key === "operator")?.id ?? roles[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLocale();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !email.trim() || password.length < 8 || !roleId) {
      setError("Barcha maydonlarni to'ldiring — parol kamida 8 belgi.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password, roleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messages: Record<string, string> = {
          email_taken: "Bu email allaqachon ro'yxatdan o'tgan.",
          weak_password: "Parol kamida 8 belgidan iborat bo'lishi kerak.",
          forbidden: "Bu amal uchun ruxsatingiz yo'q.",
        };
        setError(messages[data.error] ?? "Xatolik yuz berdi.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Ulanishda xatolik. Qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">Yangi foydalanuvchi</h2>
          <button type="button" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">Ism familiya</label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={fullName} onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">Email</label>
          <input
            type="email"
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">Parol (kamida 8 belgi)</label>
          <input
            type="password"
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="mb-5">
          <label className="block text-[12px] text-muted mb-1">Rol</label>
          <select
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px]"
            value={roleId} onChange={(e) => setRoleId(e.target.value)}
          >
            {roles.map((r) => <option key={r.id} value={r.id}>{t(`roles.${r.key}` as any)}</option>)}
          </select>
        </div>

        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
          {submitting ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Yaratish"}
        </button>
      </form>
    </div>
  );
}

export default function UsersManager() {
  const { t } = useLocale();
  const { profile: myProfile } = useCurrentProfile();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, is_active, role_id, created_at, last_login_at").order("created_at", { ascending: false }),
      supabase.from("roles").select("id, key, name").order("name"),
    ]);
    setUsers((usersData as UserRow[]) ?? []);
    setRoles((rolesData as Role[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const changeRole = async (userId: string, roleId: string) => {
    await supabase.from("profiles").update({ role_id: roleId }).eq("id", userId);
    load();
  };

  const toggleActive = async (user: UserRow) => {
    await supabase.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id);
    load();
  };

  const deleteUser = async (user: UserRow) => {
    if (!confirm(`${user.full_name || "Bu foydalanuvchi"}ni butunlay o'chirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi.`)) return;
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (res.ok) load();
    else alert("O'chirishda xatolik yuz berdi.");
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[22px] font-bold">Foydalanuvchilar</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"
        >
          <Plus size={15} /> Yangi foydalanuvchi
        </button>
      </div>
      <p className="text-[13px] text-muted mb-6">Ism, rollarni boshqaring va hisoblarni faollashtiring/o'chiring.</p>

      {loading && <p className="text-[13px] text-muted">{t("common.loading")}</p>}

      <div className="rounded-xl border border-white/8 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Ism</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Holat</th>
              <th className="text-left px-4 py-3 font-medium">Oxirgi kirish</th>
              <th className="text-right px-4 py-3 font-medium">Amal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => {
              const isSelf = u.id === myProfile?.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <NameCell user={u} onSaved={load} />
                      {isSelf && <span className="text-[11px] text-[#5b6f85]">(siz)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role_id}
                      disabled={isSelf}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[12px] disabled:opacity-50"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{t(`roles.${r.key}` as any)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${u.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-[#5b6f85] border-white/10"}`}>
                      {u.is_active ? "Faol" : "Faolsiz"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5b6f85]">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px]"
                        title={u.is_active ? "Faolsizlantirish (kirish taqiqlanadi)" : "Faollashtirish (kirishga ruxsat)"}
                      >
                        {u.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} className="text-[#4ADE80]" />}
                        {u.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={isSelf}
                        className="p-1.5 rounded-md hover:bg-[#FF6B85]/10 text-[#FF6B85] disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="O'chirish"
                        title="Butunlay o'chirish"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal roles={roles} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
