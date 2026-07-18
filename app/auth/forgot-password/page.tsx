"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { AuthShell, FieldError, FieldSuccess, inputClass, submitButtonClass } from "@/lib/auth/AuthShell";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();

const { error } = await supabase.auth.resetPasswordForEmail(email, {
 redirectTo: "https://couponbet.org/auth/reset-password",
});

if (error) {
  console.error("RESET ERROR:", error);
  alert(JSON.stringify(error));
  throw error;
}

setSent(true);

} catch {
  setError(t("login.genericError"));
} finally {
  setLoading(false);
}
  };

  return (
    <AuthShell
      title={t("forgotPassword.title")}
      subtitle={!sent ? t("forgotPassword.subtitle") : undefined}
      footer={
        <Link href="/auth/login" className="text-accent font-medium hover:underline">
          {t("forgotPassword.backToLogin")}
        </Link>
      }
    >
      {sent ? (
        <FieldSuccess>{t("forgotPassword.success")}</FieldSuccess>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="block text-[12px] text-muted mb-1.5">{t("common.email")}</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="you@example.com"
            />
          </div>
          <FieldError>{error}</FieldError>
          <button type="submit" disabled={loading} className={submitButtonClass}>
            {loading ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
