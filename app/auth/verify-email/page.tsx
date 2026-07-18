"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { AuthShell, submitButtonClass } from "@/lib/auth/AuthShell";

export default function VerifyEmailPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<"checking" | "success" | "failure">("checking");

  useEffect(() => {
    const supabase = createClient();
    // The confirmation link establishes a session via the URL hash, which
    // @supabase/ssr processes automatically on load.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "success" : "failure");
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthShell title={t("verifyEmail.title")}>
      <div className="flex flex-col items-center text-center">
        {status === "checking" && <p className="text-[13px] text-muted">{t("common.loading")}</p>}
        {status === "success" && (
          <>
            <CheckCircle2 size={40} className="text-[#4ADE80] mb-3" />
            <p className="text-[13px] text-muted leading-relaxed">{t("verifyEmail.success")}</p>
          </>
        )}
        {status === "failure" && (
          <>
            <XCircle size={40} className="text-[#FF6B85] mb-3" />
            <p className="text-[13px] text-muted leading-relaxed">{t("verifyEmail.failure")}</p>
          </>
        )}
        <a href="/auth/login" className={`${submitButtonClass} inline-block text-center mt-5`}>
          {t("verifyEmail.goToLogin")}
        </a>
      </div>
    </AuthShell>
  );
}
