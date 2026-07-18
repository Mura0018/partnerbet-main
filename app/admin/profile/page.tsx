"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { checkPasswordStrength } from "@/lib/auth/password";
import { PasswordStrengthMeter } from "@/lib/auth/PasswordStrengthMeter";
import { useCurrentProfile } from "@/lib/auth/permissions";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { profile, loading: profileLoading } = useCurrentProfile();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const strength = checkPasswordStrength(newPassword);
    if (!strength.valid) {
      setError(t(`passwordStrength.${strength.failedRules[0]}`));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      setLoading(false);

      if (!res.ok) {
        if (json.error === "wrong_current_password") setError(t("changePassword.wrongCurrent"));
        else if (json.error === "weak_password") setError(t(`passwordStrength.${json.failedRules?.[0] ?? "tooShort"}`));
        else setError(t("login.genericError"));
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setLoading(false);
      setError(t("login.genericError"));
    }
  };

  const logoutEverywhere = async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-[22px] font-bold mb-1">Profil</h1>
      <p className="text-[13px] text-muted mb-6">Hisob ma'lumotlari va xavfsizlik sozlamalari.</p>

      {!profileLoading && profile && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
          <div className="text-[14px] font-semibold">{profile.full_name || "—"}</div>
          <div className="text-[12px] text-muted mt-1">
            {t(`roles.${profile.roles?.key ?? "user"}` as any)}
          </div>
        </div>
      )}

      <form onSubmit={handleChangePassword} className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
        <h2 className="text-[15px] font-semibold mb-4">{t("changePassword.title")}</h2>

        <label className="block text-[12px] text-muted mb-1.5">{t("changePassword.currentPassword")}</label>
        <div className="relative mb-4">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
          <input
            type="password" required value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-accent"
          />
        </div>

        <label className="block text-[12px] text-muted mb-1.5">{t("changePassword.newPassword")}</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
          <input
            type="password" required value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-accent"
          />
        </div>
        <PasswordStrengthMeter password={newPassword} />

        {error && <p className="text-[12px] text-[#FF6B85] mt-3">{error}</p>}
        {success && <p className="text-[12px] text-[#4ADE80] mt-3">{t("changePassword.success")}</p>}

        <button type="submit" disabled={loading} className="w-full mt-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-60">
          {loading ? t("changePassword.submitting") : t("changePassword.submit")}
        </button>
      </form>

      <button
        onClick={logoutEverywhere}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#FF3B5C]/30 text-[#FF6B85] text-[13px] font-semibold hover:bg-[#FF3B5C]/10"
      >
        <LogOut size={15} /> Barcha qurilmalardan chiqish
      </button>
    </div>
  );
}
