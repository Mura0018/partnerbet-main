"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { checkPasswordStrength } from "@/lib/auth/password";
import { AuthShell, FieldError, FieldSuccess, inputClass, submitButtonClass } from "@/lib/auth/AuthShell";
import { PasswordStrengthMeter } from "@/lib/auth/PasswordStrengthMeter";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useLocale();

  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The recovery link from the email sets a session via the URL hash;
    // @supabase/ssr processes it automatically. We just confirm it landed.
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecoverySession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    const strength = checkPasswordStrength(password);
    if (!strength.valid) {
      setError(t(`passwordStrength.${strength.failedRules[0]}`));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(t("login.genericError"));
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/auth/login"), 2000);
  };

  if (hasRecoverySession === false) {
    return (
      <AuthShell title={t("resetPassword.title")}>
        <FieldError>{t("resetPassword.invalidLink")}</FieldError>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title={t("resetPassword.title")}>
        <FieldSuccess>{t("resetPassword.success")}</FieldSuccess>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")}>
      {hasRecoverySession === null ? (
        <p className="text-[13px] text-muted text-center">{t("common.loading")}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="block text-[12px] text-muted mb-1.5">{t("resetPassword.newPassword")}</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pl-9`} placeholder="••••••••" />
          </div>
          <PasswordStrengthMeter password={password} />

          <label className="block text-[12px] text-muted mb-1.5 mt-4">{t("common.confirmPassword")}</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pl-9`} placeholder="••••••••" />
          </div>

          <FieldError>{error}</FieldError>
          <button type="submit" disabled={loading} className={submitButtonClass}>
            {loading ? t("resetPassword.submitting") : t("resetPassword.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
