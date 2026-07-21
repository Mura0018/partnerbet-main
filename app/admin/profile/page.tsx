"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut, Upload, Loader2, Pencil, Check, X, ShieldAlert, Mail, Bell, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { checkPasswordStrength } from "@/lib/auth/password";
import { PasswordStrengthMeter } from "@/lib/auth/PasswordStrengthMeter";
import { useCurrentProfile } from "@/lib/auth/permissions";
import { uploadImage } from "@/lib/media/upload";

const ROLE_COLOR: Record<string, string> = {
  super_admin: "#F4C76A",
  admin: "#3D7FFF",
  operator: "#4ADE80",
};

type MfaFactor = { id: string; status: string };

function TwoFactorSection() {
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
      setVerifyError("Xatolik yuz berdi. Qayta urinib ko'ring.");
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
      setVerifyError("6 xonali kodni kiriting.");
      return;
    }
    setVerifying(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: newFactorId });
      if (challengeError || !challenge) {
        setVerifyError("Xatolik yuz berdi. Qayta urinib ko'ring.");
        return;
      }
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: newFactorId, challengeId: challenge.id, code: verifyCode.trim() });
      if (verifyErr) {
        setVerifyError("Kod noto'g'ri. Qayta urinib ko'ring.");
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

  const unenroll = async (factorId: string) => {
    if (!confirm("Ikki bosqichli tasdiqlashni o'chirishni tasdiqlaysizmi? Bu hisobingiz xavfsizligini pasaytiradi.")) return;
    setUnenrolling(factorId);
    const supabase = createClient();
    await supabase.auth.mfa.unenroll({ factorId });
    setUnenrolling(null);
    await loadFactors();
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-1">Ikki bosqichli tasdiqlash (2FA)</h2>
      <p className="text-[12px] text-muted mb-4 leading-relaxed">
        Yoqilsa, kirishda parolingizdan tashqari, telefoningizdagi autentifikator ilova (Google Authenticator, Authy va h.k.) kodi ham so'raladi.
      </p>

      {factors.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-3.5 py-3">
          <span className="text-[13px] text-[#4ADE80]">✓ Yoqilgan</span>
          <button
            onClick={() => unenroll(factors[0].id)}
            disabled={unenrolling === factors[0].id}
            className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white disabled:opacity-50"
          >
            {unenrolling === factors[0].id ? "…" : "O'chirish"}
          </button>
        </div>
      ) : !enrolling ? (
        <button onClick={startEnroll} className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          Yoqish
        </button>
      ) : (
        <form onSubmit={confirmEnroll}>
          {qrCode ? (
            <>
              <p className="text-[12px] text-muted mb-3">
                Autentifikator ilovangiz bilan QR kodni skanerlang, yoki kalitni qo'lda kiriting:
              </p>
              <div className="bg-white p-3 rounded-lg w-fit mb-3">
                <img src={qrCode} alt="2FA QR kod" className="w-40 h-40" />
              </div>
              <div className="text-[11px] font-mono text-muted mb-4 break-all bg-white/5 rounded-lg p-2.5">{secret}</div>
              <label className="block text-[12px] text-muted mb-1.5">Ilovadagi 6 xonali kodni kiriting</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-3 tracking-[0.3em] text-center"
                placeholder="000000"
              />
              {verifyError && <p className="text-[12px] text-[#FF6B85] mb-3">{verifyError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={cancelEnroll} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px]">
                  Bekor qilish
                </button>
                <button type="submit" disabled={verifying} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
                  {verifying ? "…" : "Tasdiqlash"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">Yuklanmoqda…</p>
          )}
        </form>
      )}
    </div>
  );
}


function StatsSection() {
  const [stats, setStats] = useState<{ resolvedOrders: number; supportReplies: number } | null>(null);

  React.useEffect(() => {
    fetch("/api/profile/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-accent" /> Shu oylik statistika</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3.5">
          <div className="text-[22px] font-extrabold text-accent">{stats.resolvedOrders}</div>
          <div className="text-[11px] text-muted mt-0.5">Bajarilgan buyurtma</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3.5">
          <div className="text-[22px] font-extrabold text-accent">{stats.supportReplies}</div>
          <div className="text-[11px] text-muted mt-0.5">Murojaatga javob</div>
        </div>
      </div>
    </div>
  );
}

function NotificationPrefsSection() {
  const [notifyOrders, setNotifyOrders] = useState(true);
  const [notifySecurityPref, setNotifySecurityPref] = useState(true);
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
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-1 flex items-center gap-2"><Bell size={16} className="text-accent" /> Telegram bildirishnomalari</h2>
      <p className="text-[12px] text-muted mb-2">Botga ulangan bo'lsangiz, qaysi xabarlarni olishni tanlang.</p>
      <div className="divide-y divide-white/5">
        <Toggle checked={notifyOrders} onChange={(v) => { setNotifyOrders(v); save(v, notifySecurityPref); }} label="Yangi buyurtma xabarlari" />
        <Toggle checked={notifySecurityPref} onChange={(v) => { setNotifySecurityPref(v); save(notifyOrders, v); }} label="Xavfsizlik ogohlantirishlari" />
      </div>
    </div>
  );
}

function EmailChangeSection() {
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
      setError("Yangi email kiriting.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateError) {
        setError("Email o'zgartirishda xatolik yuz berdi.");
        return;
      }
      setMessage(`Tasdiqlash havolasi ${newEmail.trim()} manziliga yuborildi. Havolani bosgach email o'zgaradi.`);
      setEditing(false);
      setNewEmail("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><Mail size={16} className="text-accent" /> Email manzil</h2>
      {!editing ? (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted">{currentEmail}</span>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted hover:text-white">
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
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3.5 text-[14px] outline-none focus:border-accent mb-3"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setNewEmail(""); setError(""); }} className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px]">
              Bekor qilish
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
              {saving ? "…" : "Yuborish"}
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

function describeDeviceSimple(userAgent: string | null): string {
  if (!userAgent) return "noma'lum qurilma";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("android") ? "Android" : ua.includes("iphone") || ua.includes("ipad") ? "iPhone/iPad" : ua.includes("windows") ? "Windows" : ua.includes("macintosh") ? "Mac" : "noma'lum";
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome") ? "Chrome" : ua.includes("firefox") ? "Firefox" : ua.includes("safari") ? "Safari" : "brauzer";
  return `${os}, ${browser}`;
}

function LoginHistorySection() {
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
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 mb-6">
      <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-accent" /> Oxirgi kirishlar</h2>
      <div className="space-y-2">
        {history.map((h, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-white/5 last:border-0">
            <span className={h.success ? "text-[#4ADE80] shrink-0" : "text-[#FF6B85] shrink-0"}>{h.success ? "✅" : "❌"}</span>
            <span className="text-muted flex-1 min-w-0 truncate">{h.ip_address ?? "—"} · {describeDeviceSimple(h.user_agent)}</span>
            <span className="text-muted shrink-0 text-[11px]">{new Date(h.created_at).toLocaleDateString()}</span>
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
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[14px] outline-none focus:border-accent"
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
              {displaySaved && <div className="text-[11px] text-[#4ADE80] mt-0.5">Saqlandi ✓</div>}
            </div>
          </div>

          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-[13px] cursor-pointer hover:bg-white/5 w-fit">
            {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Rasm yuklash
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={avatarUploading}
              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
          </label>
        </div>
      )}

      <StatsSection />
      <NotificationPrefsSection />
      <EmailChangeSection />

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

      <TwoFactorSection />
      <LoginHistorySection />

      <button onClick={logoutEverywhere} className="flex items-center gap-2 text-[13px] text-[#FF6B85] hover:underline">
        <LogOut size={14} /> Barcha qurilmalardan chiqish
      </button>
    </div>
  );
}
