"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { AuthShell, FieldError, FieldSuccess, inputClass, submitButtonClass } from "@/lib/auth/AuthShell";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_admin") setError(t("login.notAdmin"));
    if (searchParams.get("verified") === "1") setError("");
  }, [searchParams, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowResend(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error === "rate_limited") {
          setError(t("login.rateLimited", { minutes: json.retryAfterMinutes }));
        } else if (json.error === "email_not_confirmed") {
          setError(t("login.emailNotConfirmed"));
          setShowResend(true);
        } else if (json.error === "invalid_credentials") {
        setError(t("login.invalidCredentials"));
        } else {
          setError(t("login.genericError"));
        }
        setLoading(false);
        return;
      }
     // Route handler set the session cookies server-side; refresh the
// browser client so it picks them up, then redirect appropriately.
const redirectTo = searchParams.get("redirect");

router.refresh();
window.location.href = redirectTo || "/admin/dashboard";
return;

} catch {
  setError(t("login.genericError"));
  setLoading(false);
}
};

const resendConfirmation = async () => {
  const supabase = createClient();
  await supabase.auth.resend({ type: "signup", email });
  setResendSent(true);

  };

  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      <form onSubmit={handleLogin}>
        <label className="block text-[12px] text-muted mb-1.5">{t("common.email")}</label>
        <div className="relative mb-4">
          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} pl-9`}
            placeholder="you@example.com"
          />
        </div>

        <label className="block text-[12px] text-muted mb-1.5">{t("common.password")}</label>
        <div className="relative mb-2">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85]" />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pl-9`}
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-[12px] text-muted cursor-pointer">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            {t("login.rememberMe")}
          </label>
          <Link href="/auth/forgot-password" className="text-[12px] text-accent hover:underline">
            {t("login.forgotPassword")}
          </Link>
        </div>

        <FieldError>{error}</FieldError>
        {showResend && !resendSent && (
          <button type="button" onClick={resendConfirmation} className="text-[12px] text-accent hover:underline mt-2">
            {t("login.resendConfirmation")}
          </button>
        )}
        {resendSent && <FieldSuccess>{t("login.resendSent")}</FieldSuccess>}

        <button type="submit" disabled={loading} className={submitButtonClass}>
          {loading ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
