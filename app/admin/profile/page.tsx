"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut, Upload, Loader2, Pencil, Check, X, ShieldAlert, Mail, Bell, TrendingUp, MessageSquare, Send } from "lucide-react";
import { PasswordInput } from "@/lib/ui/PasswordInput";
import { ThemePicker } from "@/lib/ui/ThemePicker";
import type { ChatThemeKey } from "@/lib/ui/chatThemes";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useSiteTimezone } from "@/lib/site/SiteTimezoneProvider";
import { formatDate } from "@/lib/format";
import { checkPasswordStrength } from "@/lib/auth/password";
import { PasswordStrengthMeter } from "@/lib/auth/PasswordStrengthMeter";
import { useCurrentProfile, usePermission } from "@/lib/auth/permissions";
import { uploadImage } from "@/lib/media/upload";
import { useConfirm } from "@/lib/ui/useConfirm";
import { toast } from "@/lib/ui/toast";

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#F4C76A",
  admin: "#3D7FFF",
  operator: "#4ADE80",
};

type MfaFactor = { id: string; status: string };

function TwoFactorSection() {
  const { t } = useLocale();
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [newFactorId, setNewFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const loadFactors = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).filter((f) => f.status === "verified"));
    setLoading(false);
  };

  React.useEffect(() => { loadFactors(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    setVerifyError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      setVerifyError(t("prof.err"));
      setEnrolling(false);
      return;
    }
    setNewFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const cancelEnroll = async () => {
    if (newFactorId) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: newFactorId });
    }
    setEnrolling(false);
    setQrCode("");
    setSecret("");
    setNewFactorId("");
    setVerifyCode("");
    setVerifyError("");
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    if (verifyCode.trim().length !== 6) {
      setVerifyError(t("prof.enterCode6"));
      return;
    }
    setVerifying(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: newFactorId });
      if (challengeError || !challenge) {
        setVerifyError(t("prof.err"));
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: newFactorId, challengeId: challenge.id, code: verifyCode.trim() });
      if (verifyErr) {
        setVerifyError(t("prof.wrongCode"));
        return;
      }
      setEnrolling(false);
      setQrCode("");
      setSecret("");
      setNewFactorId("");
      setVerifyCode("");
      await loadFactors();
    } finally {
      setVerifying(false);
    }
  };

  const unenroll = (factorId: string) => {
    confirm(t("prof.confirmDisable2fa"), async () => {
      setUnenrolling(factorId);
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId });
      setUnenrolling(null);
      await loadFactors();
    });
  };

  if (loading) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-1">{t("prof.twoFa")}</h2>
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        {t("prof.twoFaDesc")}
      </p>

      {factors.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-3.5 py-3">
          <span className="text-[13px] text-[#4ADE80]">✓ Yoqilgan</span>
          <button
            onClick={() => unenroll(factors[0].id)}
            disabled={unenrolling === factors[0].id}
            className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-subtle text-muted hover:text-white disabled:opacity-50"
          >
            {unenrolling === factors[0].id ? "…" : t("prof.disable")}
          </button>
        </div>
      ) : !enrolling ? (
        <button onClick={startEnroll} className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          {t("prof.enable")}
        </button>
      ) : (
        <form onSubmit={confirmEnroll}>
          {qrCode ? (
            <>
              <p className="text-[12px] text-muted mb-3">
                Autentifikator ilovangiz bilan QR kodni skanerlang, yoki kalitni qo'lda kiriting:
              </p>
              <div className="bg-white p-3 rounded-lg w-fit mb-3">
                <img src={qrCode} alt={t("prof.qrAlt")} className="w-40 h-40" />
              </div>
              <div className="text-[11px] font-mono text-muted mb-4 break-all bg-white/5 rounded-lg p-2.5">{secret}</div>
              <label className="block text-[12px] text-muted mb-1.5">{t("prof.enterAppCode")}</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-white/5 border border-subtle rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-3 tracking-[0.3em] text-center"
                placeholder="000000"
              />
              {verifyError && <p className="text-[12px] text-[#FF6B85] mb-3">{verifyError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={cancelEnroll} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-subtle text-[13px]">
                  Bekor qilish
                </button>
                <button type="submit" disabled={verifying} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
                  {verifying ? "…" : t("prof.confirm")}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">{t("prof.loading")}</p>
          )}
        </form>
      )}
      {confirmDialog}
    </div>
  );
}


function StatsSection() {
  const { t } = useLocale();
  const [stats, setStats] = useState<{ resolvedOrders: number; supportReplies: number } | null>(null);

  React.useEffect(() => {
    fetch("/api/profile/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-accent" /> {t("prof.stats")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3.5">
          <div className="text-[22px] font-extrabold text-accent">{stats.resolvedOrders}</div>
          <div className="text-[11px] text-muted mt-0.5">{t("prof.statDone")}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3.5">
          <div className="text-[22px] font-extrabold text-accent">{stats.supportReplies}</div>
          <div className="text-[11px] text-muted mt-0.5">{t("prof.statReplies")}</div>
        </div>
      </div>
    </div>
  );
}

function ChatThemeSection() {
  const { t } = useLocale();
  const [theme, setTheme] = useState("blue");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("chat_theme").eq("id", user.id).maybeSingle();
      if (data?.chat_theme) setTheme(data.chat_theme);
      setLoading(false);
    });
  }, []);

  const change = async (next: ChatThemeKey) => {
    setTheme(next);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ chat_theme: next }).eq("id", user.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2"><MessageSquare size={16} className="text-accent" /> {t("prof.chatTheme")}</h2>
      <p className="text-[12px] text-muted mb-3">{t("prof.chatThemeHint")}</p>
      <ThemePicker value={theme} onChange={change} />
      {saved && <p className="text-[11px] text-[#4ADE80] mt-2">{t("prof.saved")}</p>}
    </div>
  );
}


// 6c — Telegram'ni ulash (profil). OrdersTab'dagi TelegramLinkWidget bilan
// AYNAN bir xil endpoint va oqim: POST -> bir martalik 6 belgili kod (10 daq),
// foydalanuvchi botga "/link KOD" yuboradi, webhook tasdiqlab chat_id'ni
// yozadi va kodni o'chiradi. GET -> faqat ulangan/ulanmagan (chat_id qaytmaydi),
// DELETE -> uzish. Faqat telegram_orders.manage yoki cashdesks.fill
// ruxsatlilarga ko'rinadi (endpoint ham shu ikkisiga kod beradi).
function TelegramLinkSection() {
  const { t } = useLocale();
  const canOrders = usePermission("telegram_orders.manage");
  const canFill = usePermission("cashdesks.fill");
  const visible = canOrders === true || canFill === true;
  const [linked, setLinked] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const checkStatus = React.useCallback(async () => {
    setStatusError(false);
    try {
      const res = await fetch("/api/admin/telegram-link", { cache: "no-store" });
      if (!res.ok) throw new Error("status");
      const data = await res.json();
      setLinked(!!data.linked);
      if (data.linked) setCode("");
    } catch {
      setLinked(null);
      setStatusError(true);
    }
  }, []);

  React.useEffect(() => { if (visible) checkStatus(); }, [visible, checkStatus]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/telegram-link", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) setCode(data.code);
      else toast.error(t("prof.tgErr"));
    } catch {
      toast.error(t("prof.tgErr"));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/telegram-link", { method: "DELETE" });
      if (!res.ok) toast.error(t("prof.tgErr"));
      setCode("");
      await checkStatus();
    } catch {
      toast.error(t("prof.tgErr"));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-[15px] font-semibold flex items-center gap-2"><Send size={16} className="text-accent" /> {t("prof.tgTitle")}</h2>
        {linked !== null && (
          <span className={`text-[12px] px-2 py-0.5 rounded-full ${linked ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-[#F4C76A]/10 text-[#F4C76A]"}`}>
            {linked ? t("prof.tgStatusLinked") : t("prof.tgStatusNotLinked")}
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted mb-3">{t("prof.tgHint")}</p>

      {statusError ? (
        <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
          <span>{t("prof.tgCheckFailed")}</span>
          <button onClick={checkStatus} className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg border border-subtle hover:bg-white/5">{t("prof.tgRefresh")}</button>
        </div>
      ) : linked === null ? (
        <div className="text-[12px] text-muted">{t("prof.tgChecking")}</div>
      ) : linked ? (
        <button onClick={unlink} disabled={busy}
          className="text-[12px] px-3 py-1.5 rounded-lg border border-subtle text-muted hover:text-white disabled:opacity-60">
          {busy ? "…" : t("prof.tgUnlink")}
        </button>
      ) : code ? (
        <div className="space-y-2">
          <div className="text-[13px]">
            {t("prof.tgSendToBot")} <span className="font-mono font-bold select-all">/link {code}</span>
          </div>
          <div className="text-[11.5px] text-muted">{t("prof.tgCodeTtl")}</div>
          <button onClick={checkStatus} className="text-[12px] px-3 py-1.5 rounded-lg border border-subtle hover:bg-white/5">{t("prof.tgRefresh")}</button>
        </div>
      ) : (
        <button onClick={generate} disabled={busy}
          className="text-[12px] px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/30 font-semibold disabled:opacity-60">
          {busy ? "…" : t("prof.tgGetCode")}
        </button>
      )}
    </div>
  );
}

function NotificationPrefsSection() {
  const { t } = useLocale();
  const [notifyOrders, setNotifyOrders] = useState(true);
  const [notifySecurityPref, setNotifySecurityPref] = useState(true);
  // 6b: faqat 'cashdesks.fill' ruxsatlilarga ko'rinadi. Ustun (0102) hali
  // yo'q bo'lsa null qoladi va toggle chizilmaydi — eski ikki toggle buzilmaydi.
  // super_admin uchun yashiriladi: u past balans xabarini har doim oladi
  // (notifyLowBalance 1-auditoriya toggle'ga qaramaydi) — toggle soxta bo'lardi.
  const canFill = usePermission("cashdesks.fill");
  const { profile: me } = useCurrentProfile();
  const isSuperAdmin = me?.roles?.key === "super_admin";
  const [notifyCashdeskLow, setNotifyCashdeskLow] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("notify_orders, notify_security").eq("id", user.id).maybeSingle();
      if (data) {
        setNotifyOrders(data.notify_orders ?? true);
        setNotifySecurityPref(data.notify_security ?? true);
      }
      const { data: cd, error: cdErr } = await supabase.from("profiles").select("notify_cashdesk_low").eq("id", user.id).maybeSingle();
      if (!cdErr && cd) setNotifyCashdeskLow((cd as any).notify_cashdesk_low ?? true);
      setLoading(false);
    });
  }, []);

  const save = async (orders: boolean, security: boolean) => {
    setSaving(true);
    try {
      await fetch("/api/profile/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOrders: orders, notifySecurity: security }),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveCashdeskLow = async (v: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyCashdeskLow: v }),
      });
      if (!res.ok) setNotifyCashdeskLow(!v); // saqlanmadi -> holatni qaytarish
    } catch {
      setNotifyCashdeskLow(!v);
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      onClick={() => onChange(!checked)}
      disabled={saving}
      className="w-full flex items-center justify-between py-2.5 disabled:opacity-60"
    >
      <span className="text-[13px]">{label}</span>
      <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? "bg-accent" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );

  if (loading) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2"><Bell size={16} className="text-accent" /> {t("prof.notif")}</h2>
      <p className="text-[12px] text-muted mb-2">{t("prof.notifHint")}</p>
      <div className="divide-y divide-subtle">
        <Toggle checked={notifyOrders} onChange={(v) => { setNotifyOrders(v); save(v, notifySecurityPref); }} label={t("prof.notifOrders")} />
        <Toggle checked={notifySecurityPref} onChange={(v) => { setNotifySecurityPref(v); save(notifyOrders, v); }} label={t("prof.notifSecurity")} />
        {canFill && !isSuperAdmin && notifyCashdeskLow !== null && (
          <Toggle checked={notifyCashdeskLow} onChange={(v) => { setNotifyCashdeskLow(v); saveCashdeskLow(v); }} label={t("prof.notifCashdeskLow")} />
        )}
      </div>
    </div>
  );
}

function EmailChangeSection() {
  const { t } = useLocale();
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentEmail(user?.email ?? ""));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!newEmail.trim() || newEmail.trim() === currentEmail) {
      setError(t("prof.enterNewEmail"));
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateError) {
        setError(t("prof.emailErr"));
        return;
      }
      setMessage(t("prof.emailSent", { email: newEmail.trim() }));
      setEditing(false);
      setNewEmail("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><Mail size={16} className="text-accent" /> {t("prof.email")}</h2>
      {!editing ? (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">{currentEmail}</span>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-subtle text-muted hover:text-white">
            <Pencil size={12} /> O'zgartirish
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <input
            type="email"
            required
            autoFocus
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="yangi@email.com"
            className="w-full bg-white/5 border border-subtle rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-3"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setNewEmail(""); setError(""); }} className="flex-1 py-2 rounded-lg bg-white/5 border border-subtle text-[13px]">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
              {saving ? "…" : t("prof.send")}
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-[12px] text-[#FF6B85] mt-3">{error}</p>}
      {message && <p className="text-[12px] text-[#4ADE80] mt-3">{message}</p>}
    </div>
  );
}

type LoginHistoryRow = { ip_address: string | null; user_agent: string | null; success: boolean; created_at: string };

function describeDeviceSimple(userAgent: string | null, t: (k: any, v?: any) => string): string {
  if (!userAgent) return t("prof.unknownDevice");
  const ua = userAgent.toLowerCase();
  const os = ua.includes("android") ? "Android" : ua.includes("iphone") || ua.includes("ipad") ? "iPhone/iPad" : ua.includes("windows") ? "Windows" : ua.includes("macintosh") ? "Mac" : t("prof.unknown");
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome") ? "Chrome" : ua.includes("firefox") ? "Firefox" : ua.includes("safari") ? "Safari" : t("prof.browser");
  return `${os}, ${browser}`;
}

function LoginHistorySection() {
  const { t } = useLocale();
  const tz = useSiteTimezone();
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch("/api/profile/login-history")
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading || history.length === 0) return null;

  return (
    <div className="rounded-xl glass-card p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-accent" /> {t("prof.lastLogins")}</h2>
      <div className="space-y-2">
        {history.map((h, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-subtle last:border-0">
            <span className={h.success ? "text-[#4ADE80] shrink-0" : "text-[#FF6B85] shrink-0"}>{h.success ? "✅" : "❌"}</span>
            <span className="text-muted flex-1 min-w-0 truncate">{h.ip_address ?? "—"} · {describeDeviceSimple(h.user_agent, t)}</span>
            <span className="text-muted shrink-0 text-[11px]">{formatDate(h.created_at, { timeZone: tz })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { profile, loading: profileLoading } = useCurrentProfile();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [displaySaved, setDisplaySaved] = useState(false);
  const [editingName, setEditingName] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName((profile as any).display_name ?? "");
      setAvatarUrl((profile as any).avatar_url ?? null);
    }
  }, [profile]);

  const roleKey = profile?.roles?.key ?? "user";
  const roleColor = ROLE_COLOR[roleKey] ?? "#5b6f85";

  const saveDisplay = async () => {
    if (!profile) return;
    setSavingDisplay(true);
    setDisplaySaved(false);
    const supabase = createClient();
    await supabase.from("profiles").update({ display_name: displayName.trim() || null, avatar_url: avatarUrl }).eq("id", profile.id);
    setSavingDisplay(false);
    setDisplaySaved(true);
    setEditingName(false);
    setTimeout(() => setDisplaySaved(false), 2000);
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const media = await uploadImage(file);
      setAvatarUrl(media.publicUrl);
    } catch {
    } finally {
      setAvatarUploading(false);
    }
  };

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
        else if (json.error === "rate_limited") setError(t("changePassword.rateLimited"));
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
      <h1 className="text-[22px] font-bold mb-1">{t("prof.title")}</h1>
      <p className="text-[13px] text-muted mb-6">{t("prof.sub")}</p>

      {!profileLoading && profile && (
        <div className="rounded-xl glass-card p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: roleColor }} />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold border-2"
                style={{ borderColor: roleColor, color: roleColor, background: `${roleColor}1a` }}
              >
                {(displayName || profile.full_name || "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {!editingName ? (
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold truncate" style={{ color: roleColor }}>
                    {displayName || profile.full_name || "—"}
                  </span>
                  <button onClick={() => setEditingName(true)} className="shrink-0 p-1 rounded-md hover:bg-white/10 text-muted" aria-label="Ismni tahrirlash">
                    <Pencil size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    className="flex-1 min-w-0 bg-white/5 border border-subtle rounded-lg py-1.5 px-2.5 text-[14px] outline-none focus:border-accent"
                    placeholder={profile.full_name ?? ""}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDisplay()}
                  />
                  <button onClick={saveDisplay} disabled={savingDisplay} className="shrink-0 p-1.5 rounded-md bg-accent/20 text-accent" aria-label="Saqlash">
                    <Check size={13} />
                  </button>
                  <button onClick={() => { setEditingName(false); setDisplayName((profile as any).display_name ?? ""); }} className="shrink-0 p-1.5 rounded-md bg-white/5 text-muted" aria-label="Bekor qilish">
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="text-[12px] text-muted mt-0.5">{t(`roles.${roleKey}` as any)}</div>
              {displaySaved && <div className="text-[11px] text-[#4ADE80] mt-0.5">{t("prof.saved")}</div>}
            </div>
          </div>

          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-subtle text-[13px] cursor-pointer hover:bg-white/5 w-fit">
            {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Rasm yuklash
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={avatarUploading}
              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
          </label>
        </div>
      )}

      <StatsSection />
      <ChatThemeSection />
      <TelegramLinkSection />
      <NotificationPrefsSection />
      <EmailChangeSection />

      <form onSubmit={handleChangePassword} className="rounded-xl glass-card p-5 mb-6">
        <h2 className="text-[15px] font-semibold mb-4">{t("changePassword.title")}</h2>

        <label className="block text-[12px] text-muted mb-1.5">{t("changePassword.currentPassword")}</label>
        <div className="relative mb-4">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85] z-10" />
          <PasswordInput
            required value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-white/5 border border-subtle rounded-lg py-2.5 pl-9 text-[14px] outline-none focus:border-accent"
          />
        </div>

        <label className="block text-[12px] text-muted mb-1.5">{t("changePassword.newPassword")}</label>
        <div className="relative">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5b6f85] z-10" />
          <PasswordInput
            required value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white/5 border border-subtle rounded-lg py-2.5 pl-9 text-[14px] outline-none focus:border-accent"
          />
        </div>
        <PasswordStrengthMeter password={newPassword} />

        {error && <p className="text-[12px] text-[#FF6B85] mt-3">{error}</p>}
        {success && <p className="text-[12px] text-[#4ADE80] mt-3">{t("changePassword.success")}</p>}

        <button type="submit" disabled={loading} className="w-full mt-5 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-60">
          {loading ? t("changePassword.submitting") : t("changePassword.submit")}
        </button>
      </form>

      <TwoFactorSection />
      <LoginHistorySection />

      <button onClick={logoutEverywhere} className="flex items-center gap-2 text-[13px] text-[#FF6B85] hover:underline">
        <LogOut size={14} /> Barcha qurilmalardan chiqish
      </button>
    </div>
  );
}
