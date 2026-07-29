"use client";

import React, { useEffect, useState } from "react";
import { Building2, Plus, X, Loader2, Pencil, Trash2, Percent, CalendarClock, Inbox, Phone, Check, ArrowRight, SlidersHorizontal, Bot, Palette, Users, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { GlobalChat } from "@/lib/chat/GlobalChat";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Select } from "@/lib/ui/Select";
import { useConfirm } from "@/lib/ui/useConfirm";

type Partner = {
  id: string;
  name: string;
  company: string | null;
  status: "active" | "suspended" | "pending";
  billing_model: "commission" | "subscription";
  commission_pct: number;
  subscription_amount: number;
  currency: string;
  contact: string | null;
  created_at: string;
  bot_connected?: boolean;
  bot_username?: string | null;
  plan?: string;
  theme_key?: string;
};

function ProvisionDrawer({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const { t } = useLocale();
  const supabase = createClient();
  const [services, setServices] = useState<any[]>([]);
  const [assign, setAssign] = useState<Record<string, boolean>>({});
  const [themes, setThemes] = useState<any[]>([]);
  const [themeAccess, setThemeAccess] = useState<Record<string, boolean>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [mForm, setMForm] = useState({ fullName: "", email: "", partnerRole: "partner_admin" });
  const [mSaving, setMSaving] = useState(false);
  const [mError, setMError] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invForm, setInvForm] = useState({ period: "", model: "subscription", amount: "" });
  const [invSaving, setInvSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const loadMembers = async () => {
    const { data } = await supabase.from("partner_members").select("id, profile_id, partner_role, profiles(full_name)").eq("partner_id", partner.id);
    setMembers((data as any[]) ?? []);
  };
  const loadInvoices = async () => {
    const { data } = await supabase.from("partner_invoices").select("id, period, model, amount, currency, status").eq("partner_id", partner.id).order("period", { ascending: false });
    setInvoices((data as any[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sv, sa, th, ta] = await Promise.all([
        supabase.from("partner_services").select("id, key, name, description").order("name"),
        supabase.from("partner_service_assignments").select("service_id, enabled").eq("partner_id", partner.id),
        supabase.from("app_themes").select("id, key, name, is_premium, accent").order("sort"),
        supabase.from("partner_theme_access").select("theme_id, enabled").eq("partner_id", partner.id),
      ]);
      if (sv.error || th.error) { setMissing(true); setLoading(false); return; }
      setMissing(false);
      setServices(sv.data ?? []);
      setThemes(th.data ?? []);
      const am: Record<string, boolean> = {};
      for (const r of (sa.data ?? []) as any[]) am[r.service_id] = r.enabled;
      setAssign(am);
      const tm: Record<string, boolean> = {};
      for (const r of (ta.data ?? []) as any[]) tm[r.theme_id] = r.enabled;
      setThemeAccess(tm);
      await loadMembers();
      await loadInvoices();
      setInvForm((p) => ({ ...p, period: new Date().toISOString().slice(0, 7) }));
      setLoading(false);
    })();
  }, [partner.id]);

  const createMember = async () => {
    setMError("");
    if (!mForm.fullName.trim() || !mForm.email.trim()) { setMError(t("prt.eNameEmail")); return; }
    setMSaving(true);
    try {
      const res = await fetch("/api/admin/partners/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: partner.id, fullName: mForm.fullName.trim(), email: mForm.email.trim(), partnerRole: mForm.partnerRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        const map: Record<string, string> = { email_taken: t("prt.eEmailTaken"), forbidden: t("prt.eForbidden") };
        const msg = map[data.error] ?? t("prt.eGeneric");
        setMError(msg);
        toast.error(t("prt.tMemberFail"));
        return;
      }
      setShowAddMember(false);
      setMForm({ fullName: "", email: "", partnerRole: "partner_admin" });
      loadMembers();
      if (data.inviteUrl) { setInviteLink(data.inviteUrl); toast.success(t("prt.tMemberOk")); }
      else toast.success(t("prt.tMemberOkNoLink"));
    } catch {
      setMError(t("prt.eConnRetry"));
      toast.error(t("prt.eConnCheck"));
    } finally {
      setMSaving(false);
    }
  };

  const resetInvite = async (profileId: string) => {
    try {
      const res = await fetch("/api/admin/partners/reset-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId }) });
      const data = await res.json();
      if (res.ok && data.inviteUrl) { setInviteLink(data.inviteUrl); toast.success(t("prt.tNewLink")); }
      else toast.error(t("prt.eNoLink"));
    } catch { toast.error(t("prt.eConn")); }
  };

  const copyInvite = () => { if (inviteLink) { navigator.clipboard?.writeText(inviteLink); toast.success(t("prt.tLinkCopied")); } };

  const removeMember = (id: string) => {
    confirm(t("prt.confirmRemoveMember"), async () => {
      const { error } = await supabase.from("partner_members").delete().eq("id", id);
      if (error) { console.error("[partners] a'zo chiqarilmadi:", error); toast.error(t("prt.tRemoveFail")); }
      else toast.success(t("prt.tRemoved"));
      loadMembers();
    });
  };

  const createInvoice = async () => {
    if (!invForm.period.trim() || !(Number(invForm.amount) > 0)) { toast.error(t("prt.eInvoiceForm")); return; }
    setInvSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("partner_invoices").insert({
      partner_id: partner.id, period: invForm.period.trim(), model: invForm.model,
      amount: Number(invForm.amount) || 0, currency: partner.currency, status: "unpaid", created_by: user?.id ?? null,
    });
    setInvSaving(false);
    if (error) { console.error("[partners] invoice yaratilmadi:", error); toast.error(t("prt.tInvoiceFail")); return; }
    toast.success(t("prt.tInvoiceOk"));
    setInvForm((p) => ({ ...p, amount: "" }));
    loadInvoices();
  };
  const toggleInvoicePaid = async (inv: any) => {
    const next = inv.status === "paid" ? "unpaid" : "paid";
    const { error } = await supabase.from("partner_invoices").update({ status: next, paid_at: next === "paid" ? new Date().toISOString() : null }).eq("id", inv.id);
    if (error) { console.error("[partners] o'zgartirilmadi:", error); toast.error(t("prt.tChangeFail")); }
    else { toast.success(next === "paid" ? t("prt.tMarkedPaid") : t("prt.tMarkedUnpaid")); loadInvoices(); }
  };

  const toggleService = async (id: string) => {
    const next = !assign[id];
    setAssign((p) => ({ ...p, [id]: next }));
    const { error } = await supabase.from("partner_service_assignments").upsert({ partner_id: partner.id, service_id: id, enabled: next }, { onConflict: "partner_id,service_id" });
    if (error) { setAssign((p) => ({ ...p, [id]: !next })); console.error("[partners] xizmat saqlanmadi:", error); toast.error(t("prt.tNotSaved")); }
  };
  const toggleTheme = async (id: string) => {
    const next = !themeAccess[id];
    setThemeAccess((p) => ({ ...p, [id]: next }));
    const { error } = await supabase.from("partner_theme_access").upsert({ partner_id: partner.id, theme_id: id, enabled: next }, { onConflict: "partner_id,theme_id" });
    if (error) { setThemeAccess((p) => ({ ...p, [id]: !next })); console.error("[partners] tema saqlanmadi:", error); toast.error(t("prt.tNotSaved")); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 w-full sm:w-[440px] bg-bg border-l border-subtle flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-subtle shrink-0">
          <SlidersHorizontal size={18} className="text-accent" />
          <h2 className="text-[15px] font-bold flex-1 truncate">{t("prt.setup")} — {partner.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label={t("prt.close")}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-6 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-muted">{t("prt.loading")}</p>
          ) : missing ? (
            <div className="rounded-xl border border-[#F4C76A]/30 bg-[#F4C76A]/10 p-4 text-[13px]">
              <div className="font-semibold text-[#F4C76A] mb-1">{t("prt.missingTitle")}</div>
              <div className="text-muted">{t("prt.missingBody")}</div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2"><Bot size={15} className="text-accent" /><h3 className="text-[13px] font-bold">{t("prt.hBot")}</h3></div>
                <div className={`rounded-lg px-3 py-2.5 text-[12.5px] border ${partner.bot_username ? "bg-[#4ADE80]/10 border-[#4ADE80]/30 text-[#4ADE80]" : "bg-white/[0.03] border-subtle text-muted"}`}>
                  {partner.bot_username ? `${t("prt.botConnected")} — @${partner.bot_username}` : t("prt.botNotConnected")}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2"><Check size={15} className="text-accent" /><h3 className="text-[13px] font-bold">{t("prt.hServices")}</h3></div>
                <div className="space-y-1.5">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 rounded-lg glass-card px-3 py-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!assign[s.id]} onChange={() => toggleService(s.id)} className="accent-accent" />
                      <div className="min-w-0"><div className="text-[13px] font-medium">{s.name}</div>{s.description && <div className="text-[11px] text-muted truncate">{s.description}</div>}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2"><Palette size={15} className="text-accent" /><h3 className="text-[13px] font-bold">{t("prt.hThemes")}</h3></div>
                <div className="space-y-1.5">
                  {themes.map((thm) => (
                    <div key={thm.id} className="flex items-center gap-3 rounded-lg glass-card px-3 py-2.5">
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ background: thm.accent || "#3D7FFF" }} />
                      <div className="flex-1 min-w-0"><span className="text-[13px] font-medium">{thm.name}</span></div>
                      {thm.is_premium ? (
                        <label className="flex items-center gap-1.5 text-[11.5px] text-muted cursor-pointer">
                          <input type="checkbox" checked={!!themeAccess[thm.id]} onChange={() => toggleTheme(thm.id)} className="accent-accent" /> {t("prt.themeOn")}
                        </label>
                      ) : <span className="text-[11px] text-[#4ADE80]">{t("prt.themeFree")}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><Users size={15} className="text-accent" /><h3 className="text-[13px] font-bold">{t("prt.hMembers")}</h3></div>
                  <button onClick={() => { setShowAddMember((v) => !v); setMError(""); }} className="text-[11.5px] px-2.5 py-1 rounded-md bg-accent/15 text-[#7db8ff] hover:bg-accent/25">{t("prt.addMember")}</button>
                </div>
                {showAddMember && (
                  <div className="rounded-lg glass-card p-3 mb-2.5 space-y-2">
                    <input placeholder={t("prt.phFullName")} value={mForm.fullName} onChange={(e) => setMForm((p) => ({ ...p, fullName: e.target.value }))} className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
                    <input placeholder={t("prt.phEmail")} type="email" value={mForm.email} onChange={(e) => setMForm((p) => ({ ...p, email: e.target.value }))} className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" />
                    <p className="text-[11px] text-muted">{t("prt.noPassNote")}</p>
                    <Select
                      value={mForm.partnerRole}
                      onChange={(v) => setMForm((p) => ({ ...p, partnerRole: v }))}
                      className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
                      options={[
                        { value: "partner_admin", label: t("prt.roleAdmin") },
                        { value: "staff", label: t("prt.roleStaff") },
                      ]}
                    />
                    {mError && <p className="text-[12px] text-[#FF6B85]">{mError}</p>}
                    <button onClick={createMember} disabled={mSaving} className="w-full py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px] disabled:opacity-50">
                      {mSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : t("prt.create")}
                    </button>
                  </div>
                )}
                {inviteLink && (
                  <div className="rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/10 p-3 mb-2.5">
                    <div className="text-[11px] text-[#4ADE80] font-semibold mb-1.5">{t("prt.inviteTitle")}</div>
                    <div className="flex items-center gap-2">
                      <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 bg-white/5 border border-subtle rounded-md py-1.5 px-2 text-[11px] font-mono" />
                      <button onClick={copyInvite} className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-md bg-accent/20 text-[#7db8ff] font-medium">{t("prt.copy")}</button>
                      <button onClick={() => setInviteLink(null)} className="shrink-0 p-1.5 rounded-md hover:bg-white/10 text-muted"><X size={13} /></button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  {members.length === 0 ? (
                    <p className="text-[12px] text-muted">{t("prt.noMembers")}</p>
                  ) : members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg glass-card px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium">{m.profiles?.full_name || "—"}</span>
                        <span className="text-[10.5px] text-muted"> · {m.partner_role === "partner_admin" ? t("prt.mAdmin") : t("prt.mStaff")}</span>
                      </div>
                      <button onClick={() => resetInvite(m.profile_id)} className="text-[10.5px] px-2 py-1 rounded-md bg-white/5 text-muted hover:text-white" title={t("prt.tipResetLink")}>{t("prt.linkBtn")}</button>
                      <button onClick={() => removeMember(m.id)} className="p-1 rounded hover:bg-[#FF6B85]/10 text-[#FF6B85]" aria-label={t("prt.removeMember")}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2"><CalendarClock size={15} className="text-accent" /><h3 className="text-[13px] font-bold">{t("prt.hBilling")}</h3></div>
                <div className="rounded-lg glass-card p-3 mb-2.5 space-y-2">
                  <div className="flex gap-2">
                    <input value={invForm.period} onChange={(e) => setInvForm((p) => ({ ...p, period: e.target.value }))} placeholder="2026-07" className="w-24 bg-white/5 border border-subtle rounded-lg py-2 px-2.5 text-[12px] outline-none focus:border-accent" />
                    <Select
                      value={invForm.model}
                      onChange={(v) => setInvForm((p) => ({ ...p, model: v }))}
                      className="bg-white/5 border border-subtle rounded-lg py-2 px-2 text-[12px] flex items-center justify-between gap-2"
                      options={[
                        { value: "subscription", label: t("prt.subscription") },
                        { value: "commission", label: t("prt.commission") },
                      ]}
                    />
                    <input value={invForm.amount} onChange={(e) => setInvForm((p) => ({ ...p, amount: e.target.value }))} type="number" placeholder={t("prt.phAmount", { cur: partner.currency })} className="flex-1 min-w-0 bg-white/5 border border-subtle rounded-lg py-2 px-2.5 text-[12px] outline-none focus:border-accent" />
                  </div>
                  <button onClick={createInvoice} disabled={invSaving} className="w-full py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[12.5px] disabled:opacity-50">{invSaving ? <Loader2 size={13} className="animate-spin mx-auto" /> : t("prt.createInvoice")}</button>
                </div>
                <div className="space-y-1.5">
                  {invoices.length === 0 ? (
                    <p className="text-[12px] text-muted">{t("prt.noInvoices")}</p>
                  ) : invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 rounded-lg glass-card px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[12.5px] font-medium">{inv.period}</span>
                        <span className="text-[10.5px] text-muted"> · {inv.model === "commission" ? t("prt.commission") : t("prt.subscription")} · {Math.round(inv.amount).toLocaleString("ru-RU")} {inv.currency}</span>
                      </div>
                      <button onClick={() => toggleInvoicePaid(inv)} className={`shrink-0 text-[10.5px] px-2 py-1 rounded-md ${inv.status === "paid" ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "bg-[#F4C76A]/15 text-[#F4C76A]"}`}>{inv.status === "paid" ? t("prt.paid") : t("prt.unpaid")}</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

const CURRENCIES = ["UZS", "USD", "RUB", "EUR", "KZT", "TRY"];
const STATUS_META: Record<string, { labelKey: string; cls: string }> = {
  active: { labelKey: "prt.stActive", cls: "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" },
  pending: { labelKey: "prt.stPending", cls: "bg-[#F4C76A]/10 text-[#F4C76A] border-[#F4C76A]/30" },
  suspended: { labelKey: "prt.stSuspended", cls: "bg-[#FF6B85]/10 text-[#FF6B85] border-[#FF6B85]/30" },
};

function fmtNum(n: number) {
  return Number(n || 0).toLocaleString("ru-RU");
}

function PartnerModal({ partner, prefill, onClose, onSaved }: { partner: Partner | null; prefill?: { name?: string; company?: string }; onClose: () => void; onSaved: () => void }) {
  const { t } = useLocale();
  const editing = !!partner;
  const [name, setName] = useState(partner?.name ?? prefill?.name ?? "");
  const [company, setCompany] = useState(partner?.company ?? prefill?.company ?? "");
  const [contact, setContact] = useState(partner?.contact ?? "");
  const [currency, setCurrency] = useState(partner?.currency ?? "UZS");
  const [status, setStatus] = useState<Partner["status"]>(partner?.status ?? "active");
  const [billing, setBilling] = useState<Partner["billing_model"]>(partner?.billing_model ?? "commission");
  const [commission, setCommission] = useState(partner ? String(partner.commission_pct) : "");
  const [subscription, setSubscription] = useState(partner ? String(partner.subscription_amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError(t("prt.eName")); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        contact: contact.trim() || null,
        currency,
        status,
        billing_model: billing,
        commission_pct: billing === "commission" ? Number(commission) || 0 : 0,
        subscription_amount: billing === "subscription" ? Number(subscription) || 0 : 0,
      };
      let opError: any = null;
      let row: any = null;
      if (editing) {
        const { data, error } = await supabase.from("partners").update(payload).eq("id", partner!.id).select().single();
        opError = error; row = data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("partners").insert({ ...payload, created_by: user?.id ?? null }).select().single();
        opError = error; row = data;
      }
      // Xatoni OBYEKT bo'yicha tekshiramiz (bo'sh message'li xato ham ushlanadi) +
      // qator haqiqatan yozildi va o'qildi (row) — shundagina muvaffaqiyat.
      if (opError || !row) {
        console.error("[partners] saqlashda xatolik:", opError);
        setError(t("prt.eSavePrefix"));
        toast.error(t("prt.tNotSaved"));
        return;
      }
      toast.success(editing ? t("prt.tUpdated") : t("prt.tCreated"));
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[partners] kutilmagan xatolik:", err);
      setError(t("prt.eUnexpected"));
      toast.error(t("prt.eConnCheck"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-subtle bg-panel p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[16px]">{editing ? t("prt.editTitle") : t("prt.newTitle")}</h2>
          <button type="button" onClick={onClose} aria-label={t("prt.close")}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className="block text-[12px] text-muted mb-1">{t("prt.fName")}</label>
            <input className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">{t("prt.fCompany")}</label>
            <input className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder="1xbet" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">{t("prt.fCurrency")}</label>
            <Select
              className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1">{t("prt.fContact")}</label>
          <input className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder={t("prt.phContact")} value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="block text-[12px] text-muted mb-1.5">{t("prt.fBilling")}</label>
          <div className="flex gap-1.5 mb-2">
            {(["commission", "subscription"] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBilling(b)}
                className={`flex-1 py-2 rounded-lg text-[12.5px] font-medium border ${billing === b ? "bg-accent/20 border-accent text-white" : "bg-white/[0.02] border-subtle text-muted"}`}>
                {b === "commission" ? t("prt.bCommission") : t("prt.bSubscription")}
              </button>
            ))}
          </div>
          {billing === "commission" ? (
            <input type="number" step="0.01" className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder={t("prt.phCommission")} value={commission} onChange={(e) => setCommission(e.target.value)} />
          ) : (
            <input type="number" className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] outline-none focus:border-accent" placeholder={t("prt.phSubscription", { cur: currency })} value={subscription} onChange={(e) => setSubscription(e.target.value)} />
          )}
        </div>

        <div className="mb-5">
          <label className="block text-[12px] text-muted mb-1">{t("prt.fStatus")}</label>
          <Select
            className="w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] flex items-center justify-between gap-2"
            value={status}
            onChange={(v) => setStatus(v as Partner["status"])}
            options={[
              { value: "active", label: t("prt.stActive") },
              { value: "pending", label: t("prt.stPending") },
              { value: "suspended", label: t("prt.stSuspended") },
            ]}
          />
        </div>

        {error && <p className="text-[12px] text-[#FF6B85] mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[14px] disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin mx-auto" /> : editing ? t("prt.save") : t("prt.create")}
        </button>
      </form>
    </div>
  );
}

type PartnerLead = { id: string; name: string | null; phone: string | null; company: string | null; message: string | null; status: string; created_at: string };

const LEAD_STATUS: Record<string, { labelKey: string; cls: string }> = {
  new: { labelKey: "prt.lNew", cls: "bg-accent/15 text-[#7db8ff] border-accent/30" },
  contacted: { labelKey: "prt.lContacted", cls: "bg-[#F4C76A]/10 text-[#F4C76A] border-[#F4C76A]/30" },
  converted: { labelKey: "prt.lConverted", cls: "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/30" },
  rejected: { labelKey: "prt.lRejected", cls: "bg-[#FF6B85]/10 text-[#FF6B85] border-[#FF6B85]/30" },
};

type ModalState = { open: boolean; partner: Partner | null; prefill?: { name?: string; company?: string }; leadId?: string };

export default function PartnersManager() {
  const { t } = useLocale();
  const [view, setView] = useState<"partners" | "leads" | "chat">("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, partner: null });
  const [provisionFor, setProvisionFor] = useState<Partner | null>(null);
  const supabase = createClient();
  const { confirm, confirmDialog } = useConfirm();

  const load = async () => {
    setLoading(true);
    const [{ data: pData, error: pErr }, { data: lData }] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_leads").select("id, name, phone, company, message, status, created_at").order("created_at", { ascending: false }),
    ]);
    if (pErr) { console.error("[partners] ro'yxat yuklanmadi:", pErr); toast.error(t("prt.tLoadErr")); }
    setPartners((pData as Partner[]) ?? []);
    setLeads((lData as PartnerLead[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const newLeadsCount = leads.filter((l) => l.status === "new").length;

  const remove = (p: Partner) => {
    confirm(t("prt.confirmDelete", { name: p.name }), async () => {
      const { error } = await supabase.from("partners").delete().eq("id", p.id);
      if (error) { console.error("[partners] hamkor o'chirilmadi:", error); toast.error(t("prt.tDelFail")); }
      else { toast.success(t("prt.tDeleted")); load(); }
    });
  };

  const setLeadStatus = async (lead: PartnerLead, status: string) => {
    await supabase.from("partner_leads").update({ status, handled_at: new Date().toISOString() }).eq("id", lead.id);
    load();
  };

  const closeModal = () => setModal({ open: false, partner: null });
  const onModalSaved = async () => {
    if (modal.leadId) {
      await supabase.from("partner_leads").update({ status: "converted", handled_at: new Date().toISOString() }).eq("id", modal.leadId);
    }
    load();
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-accent" />
          <h1 className="text-[22px] font-bold">{t("prt.title")}</h1>
        </div>
        {view === "partners" && (
          <button onClick={() => setModal({ open: true, partner: null })} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
            <Plus size={15} /> {t("prt.newPartner")}
          </button>
        )}
      </div>
      <p className="text-[13px] text-muted mb-5">{t("prt.sub")}</p>

      {/* Tablar */}
      <div className="inline-flex gap-1 p-1 mb-6 rounded-xl glass-card">
        <button onClick={() => setView("partners")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${view === "partners" ? "bg-accent/20 text-white" : "text-muted hover:text-white"}`}>
          <Building2 size={14} /> {t("prt.tabPartners")}
        </button>
        <button onClick={() => setView("leads")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${view === "leads" ? "bg-accent/20 text-white" : "text-muted hover:text-white"}`}>
          <Inbox size={14} /> {t("prt.tabLeads")}
          {newLeadsCount > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B85] text-white text-[10px] font-bold flex items-center justify-center">{newLeadsCount}</span>}
        </button>
        <button onClick={() => setView("chat")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${view === "chat" ? "bg-accent/20 text-white" : "text-muted hover:text-white"}`}>
          <MessageCircle size={14} /> {t("prt.tabChat")}
        </button>
      </div>

      {view === "chat" ? (
        <div className="h-[calc(100svh-260px)] min-h-[380px]">
          <GlobalChat />
        </div>
      ) : loading ? (
        <p className="text-[13px] text-muted">{t("prt.loading")}</p>
      ) : view === "partners" ? (
        partners.length === 0 ? (
          <div className="rounded-xl glass-card p-8 text-center text-[13px] text-muted">
            {t("prt.emptyPartners")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {partners.map((p) => {
              const st = STATUS_META[p.status] ?? STATUS_META.pending;
              return (
                <div key={p.id} className="rounded-xl glass-card p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold truncate">{p.name}</div>
                      {p.company && <div className="text-[11px] text-muted truncate">{p.company}</div>}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] border ${st.cls}`}>{t(st.labelKey as any)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted mb-3">
                    <span className="flex items-center gap-1">
                      {p.billing_model === "commission"
                        ? <><Percent size={12} /> {p.commission_pct}%</>
                        : <><CalendarClock size={12} /> {fmtNum(p.subscription_amount)} {p.currency}</>}
                    </span>
                    <span className="text-[#5b6f85]">·</span>
                    <span>{p.currency}</span>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-subtle">
                    <button onClick={() => setProvisionFor(p)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/15 text-[#7db8ff] hover:bg-accent/25 text-[11.5px] font-medium">
                      <SlidersHorizontal size={13} /> {t("prt.setupBtn")}
                    </button>
                    <button onClick={() => setModal({ open: true, partner: p })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-white/10 text-[11.5px] text-muted hover:text-white">
                      <Pencil size={13} /> {t("prt.editBtn")}
                    </button>
                    <button onClick={() => remove(p)} className="ml-auto p-1.5 rounded-md hover:bg-[#FF6B85]/10 text-[#FF6B85]" aria-label={t("prt.delBtn")} title={t("prt.delBtn")}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        leads.length === 0 ? (
          <div className="rounded-xl glass-card p-8 text-center text-[13px] text-muted">
            {t("prt.emptyLeads")}
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((l) => {
              const st = LEAD_STATUS[l.status] ?? LEAD_STATUS.new;
              return (
                <div key={l.id} className="rounded-xl glass-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold truncate">{l.company || l.name || "—"}</div>
                      <div className="flex items-center gap-3 text-[11.5px] text-muted mt-0.5">
                        {l.name && <span>{l.name}</span>}
                        {l.phone && <span className="flex items-center gap-1"><Phone size={11} /> {l.phone}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] border ${st.cls}`}>{t(st.labelKey as any)}</span>
                  </div>
                  {l.message && <p className="text-[12.5px] text-white/85 bg-white/[0.03] rounded-lg px-3 py-2 my-2">{l.message}</p>}
                  <div className="text-[10.5px] text-[#5b6f85] mb-2.5">{new Date(l.created_at).toLocaleString("ru-RU")}</div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-subtle">
                    <button onClick={() => setModal({ open: true, partner: null, prefill: { name: l.company || l.name || "", company: l.company || "" }, leadId: l.id })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/15 text-[#7db8ff] hover:bg-accent/25 text-[11.5px] font-medium">
                      <ArrowRight size={13} /> {t("prt.createPartner")}
                    </button>
                    {l.status !== "contacted" && (
                      <button onClick={() => setLeadStatus(l, "contacted")} className="px-2.5 py-1.5 rounded-md hover:bg-white/10 text-[11.5px] text-muted hover:text-white">{t("prt.contacted")}</button>
                    )}
                    {l.status !== "rejected" && (
                      <button onClick={() => setLeadStatus(l, "rejected")} className="ml-auto px-2.5 py-1.5 rounded-md hover:bg-[#FF6B85]/10 text-[#FF6B85] text-[11.5px]">{t("prt.reject")}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {modal.open && <PartnerModal partner={modal.partner} prefill={modal.prefill} onClose={closeModal} onSaved={onModalSaved} />}
      {provisionFor && <ProvisionDrawer partner={provisionFor} onClose={() => setProvisionFor(null)} />}
      {confirmDialog}
    </div>
  );
}
