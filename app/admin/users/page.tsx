"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
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

export default function UsersManager() {
  const { t } = useLocale();
  const { profile: myProfile } = useCurrentProfile();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="p-8">
      <h1 className="text-[22px] font-bold mb-1">Foydalanuvchilar</h1>
      <p className="text-[13px] text-muted mb-6">Rollarni boshqaring va hisoblarni faollashtiring/o'chiring.</p>

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
                  <td className="px-4 py-3">{u.full_name || "—"}{isSelf && <span className="text-[11px] text-[#5b6f85] ml-1.5">(siz)</span>}</td>
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
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={isSelf}
                      className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={u.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                    >
                      {u.is_active ? <ShieldOff size={15} /> : <ShieldCheck size={15} className="text-[#4ADE80]" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
