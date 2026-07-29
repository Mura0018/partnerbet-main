"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Pencil, Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import { PasswordInput } from "@/lib/ui/PasswordInput";
import { createClient } from "@/lib/supabase";
import { checkPasswordStrength } from "@/lib/auth/password";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useCurrentProfile } from "@/lib/auth/permissions";
import { toast } from "@/lib/ui/toast";
import { Select } from "@/lib/ui/Select";

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
  const { t } = useLocale();
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
        className="bg-white/5 border border-subtle rounded-lg py-1 px-2 text-[12px] w-36"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder={t("usr.namePh")}
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
    if (!fullName.trim() || !email.trim() || !roleId) {
      setError(t("usr.eAllFields"));
      return;
    }
    if (!checkPasswordStrength(password, email.trim()).valid) {
      setError(t("usr.eWeak"));
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
          email_taken: t("usr.eEmailTaken"),
          weak_password: t("usr.eWeak"),
          forbidden: t("usr.eForbidden"),
        };
        setError(messages[data.error] ?? t("usr.eGeneric"));
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError(t("usr.eConn"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-subtle bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">{t("usr.newUser")}</h2>
          <button type="button" onClick={onClose} aria-label={t("usr.close")}><X size={18} /></button>
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">{t("usr.fName")}</label>
          <input
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={fullName} onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">{t("usr.fEmail")}</label>
          <input
            type="email"
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">{t("usr.fPassword")}</label>
          <PasswordInput
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="mb-5">
          <label className="block text-[12px] text-muted mb-1">{t("usr.fRole")}</label>
          <Select
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
            value={roleId}
            onChange={setRoleId}
            options={roles.map((r) => ({ value: r.id, label: t(`roles.${r.key}` as any) }))}
          />
        </div>

        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
          {submitting ? <Loader2 size={15} className="animate-spin mx-auto" /> : t("usr.create")}
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
    const res = await fetch("/api/admin/users/change-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, roleId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(
        data.error === "forbidden_role_assignment"
          ? t("usr.eRoleForbidden")
          : t("usr.eRoleChange")
      );
    }
    load();
  };

  const toggleActive = async (user: UserRow) => {
    await supabase.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id);
    load();
  };

  const deleteUser = async (user: UserRow) => {
    if (!confirm(t("usr.confirmDelete", { name: user.full_name || t("usr.thisUser") }))) return;
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (res.ok) load();
    else toast.error(t("usr.eDelete"));
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[22px] font-bold">{t("usr.title")}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]"
        >
          <Plus size={15} /> {t("usr.newUser")}
        </button>
      </div>
      <p className="text-[13px] text-muted mb-6">{t("usr.sub")}</p>

      {loading && <p className="text-[13px] text-muted">{t("common.loading")}</p>}

      <div className="rounded-xl border border-subtle overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] text-muted uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("usr.colName")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("usr.colRole")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("usr.colStatus")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("usr.colLastLogin")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("usr.colAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {users.map((u) => {
              const isSelf = u.id === myProfile?.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <NameCell user={u} onSaved={load} />
                      {isSelf && <span className="text-[11px] text-[#5b6f85]">{t("usr.you")}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role_id}
                      disabled={isSelf}
                      onChange={(v) => changeRole(u.id, v)}
                      className="bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[12px] disabled:opacity-50 flex items-center justify-between gap-2"
                      options={roles.map((r) => ({ value: r.id, label: t(`roles.${r.key}` as any) }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${u.is_active ? "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" : "bg-white/5 text-[#5b6f85] border-subtle"}`}>
                      {u.is_active ? t("usr.active") : t("usr.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5b6f85]">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-[11px]"
                        title={u.is_active ? t("usr.tipDeactivate") : t("usr.tipActivate")}
                      >
                        {u.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} className="text-[#4ADE80]" />}
                        {u.is_active ? t("usr.deactivate") : t("usr.activate")}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        disabled={isSelf}
                        className="p-1.5 rounded-md hover:bg-[#FF6B85]/10 text-[#FF6B85] disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("usr.del")}
                        title={t("usr.tipDelete")}
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
