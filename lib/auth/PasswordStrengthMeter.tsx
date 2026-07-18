"use client";

import React from "react";
import { checkPasswordStrength } from "@/lib/auth/password";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function PasswordStrengthMeter({ password, email }: { password: string; email?: string }) {
  const { t } = useLocale();
  if (!password) return null;

  const { score, failedRules } = checkPasswordStrength(password, email);
  const bars = [1, 2, 3];
  const colors = ["bg-[#FF3B5C]", "bg-vip", "bg-[#4ADE80]"];
  const labels = [t("passwordStrength.weak"), t("passwordStrength.medium"), t("passwordStrength.strong")];

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {bars.map((b) => (
          <div
            key={b}
            className={`h-1 flex-1 rounded-full transition-colors ${
              score >= b ? colors[score - 1] ?? "bg-white/10" : "bg-white/10"
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className="text-[11px] text-[#5b6f85] mt-1.5">{labels[score - 1]}</p>
      )}
      {failedRules.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {failedRules.map((rule) => (
            <li key={rule} className="text-[11px] text-[#5b6f85]">
              • {t(`passwordStrength.${rule}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
