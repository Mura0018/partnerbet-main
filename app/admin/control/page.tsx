"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Loader2, Wallet, Landmark, HandCoins, Gauge, MessageSquare, Wrench, Power, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Super admin BOSHQARUV MARKAZI — barcha oqim sozlamalari (site_settings)
// bitta joyда, guruhlangan. Mavjud kalitlar qayta ishlatiladi (rewrite emas).
// Har karta alohida saqlanadi. RLS: settings.manage (super admin).

const inp = "w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

type Settings = Record<string, any>;

function num(v: any, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export default function ControlCenter() {
  const supabase = createClient();
  const { t } = useLocale();
  const [s, setS] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_settings").select("key, value");
    const map: Settings = {};
    for (const r of (data ?? []) as any[]) map[r.key] = r.value ?? {};
    setS(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = (key: string, p: Record<string, any>) =>
    setS((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...p } }));

  const save = async (key: string, value: any) => {
    setSavingKey(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) { toast.error(t("ctl.saveFailed") + error.message); return; }
      patch(key, value); // normalizatsiya qilingan qiymatни qaytarib qo'yamiz
      toast.success(t("ctl.saved"));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-white/40"><Loader2 className="animate-spin" /></div>;

  const commission = s.betcore_commission || {};
  const limits = s.betcore_pay_limits || {};
  const switches = s.betcore_switches || {};
  const sla = s.cashdesk_sla || {};
  const debt = s.cashdesk_debt || {};
  const alert = s.cashdesk_alert || {};
  const rules = s.team_chat_rules || {};
  const maint = s.maintenance || {};
  const promo = s.promo || {};

  const Toggle = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
        on ? "bg-[#4ADE80]/15 border-[#4ADE80]/40 text-[#4ADE80]" : "bg-[#FF6B85]/10 border-[#FF6B85]/30 text-[#FF6B85]"
      }`}
    >
      <Power size={13} /> {label}: {on ? t("ctl.on") : t("ctl.off")}
    </button>
  );

  const SaveBtn = ({ k, value }: { k: string; value: any }) => (
    <button
      onClick={() => save(k, value)}
      disabled={savingKey === k}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-accent/20 text-white hover:bg-accent/30 disabled:opacity-50"
    >
      {savingKey === k && <Loader2 size={13} className="animate-spin" />} {t("ctl.save")}
    </button>
  );

  const Card = ({ icon, title, side, children }: { icon: React.ReactNode; title: string; side: string; children: React.ReactNode }) => (
    <div className="rounded-2xl glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="p-1.5 rounded-lg bg-[#1CE0C3]/10 text-[#1CE0C3]">{icon}</span>
        <div>
          <h2 className="text-[14px] font-semibold text-white">{title}</h2>
          <p className="text-[10.5px] text-white/35">{side}</p>
        </div>
      </div>
      {children}
    </div>
  );

  const L = ({ children }: { children: React.ReactNode }) => <span className="block text-[11px] text-white/40 mb-1">{children}</span>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="p-2 rounded-xl bg-[#1CE0C3]/10 text-[#1CE0C3]"><SlidersHorizontal size={20} /></span>
        <div>
          <h1 className="text-lg font-semibold text-white">{t("ctl.title")}</h1>
          <p className="text-xs text-white/40">{t("ctl.subtitle")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        {/* TO'LOV OQIMI (mijoz tarafi) */}
        <Card icon={<Wallet size={16} />} title={t("ctl.payFlow")} side={t("ctl.payFlowSide")}>
          <div className="flex gap-2 mb-3">
            <Toggle on={switches.topup !== false} label={t("ctl.topup")} onClick={() => patch("betcore_switches", { topup: !(switches.topup !== false) })} />
            <Toggle on={switches.withdraw !== false} label={t("ctl.withdraw")} onClick={() => patch("betcore_switches", { withdraw: !(switches.withdraw !== false) })} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><L>{t("ctl.commTopup")}</L><input className={inp} type="number" value={commission.topup_pct ?? ""} onChange={(e) => patch("betcore_commission", { topup_pct: e.target.value })} /></div>
            <div><L>{t("ctl.commWithdraw")}</L><input className={inp} type="number" value={commission.withdraw_pct ?? ""} onChange={(e) => patch("betcore_commission", { withdraw_pct: e.target.value })} /></div>
            <div><L>{t("ctl.maxOrder")}</L><input className={inp} type="number" value={limits.max_order_amount ?? ""} onChange={(e) => patch("betcore_pay_limits", { max_order_amount: e.target.value })} /></div>
            <div><L>{t("ctl.dailyLimit")}</L><input className={inp} type="number" value={limits.daily_customer_limit ?? ""} onChange={(e) => patch("betcore_pay_limits", { daily_customer_limit: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <SaveBtn k="betcore_switches" value={{ topup: switches.topup !== false, withdraw: switches.withdraw !== false }} />
            <SaveBtn k="betcore_commission" value={{ topup_pct: num(commission.topup_pct, 8), withdraw_pct: num(commission.withdraw_pct, 2) }} />
            <SaveBtn k="betcore_pay_limits" value={{ max_order_amount: num(limits.max_order_amount), daily_customer_limit: num(limits.daily_customer_limit) }} />
          </div>
        </Card>

        {/* KASSA (xodim tarafi) */}
        <Card icon={<Landmark size={16} />} title={t("ctl.cashSla")} side={t("ctl.cashSlaSide")}>
          <div className="mb-3">
            <L>{t("ctl.slaMinutes")}</L>
            <input className={inp} type="number" value={sla.minutes ?? ""} onChange={(e) => patch("cashdesk_sla", { minutes: e.target.value })} />
            <p className="text-[10.5px] text-white/30 mt-1">{t("ctl.slaHint")}</p>
          </div>
          <SaveBtn k="cashdesk_sla" value={{ minutes: num(sla.minutes, 5) }} />
        </Card>

        {/* QARZ (xodim tarafi) */}
        <Card icon={<HandCoins size={16} />} title={t("ctl.debt")} side={t("ctl.debtSide")}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><L>{t("ctl.debtLimit")}</L><input className={inp} type="number" value={debt.limit ?? ""} onChange={(e) => patch("cashdesk_debt", { limit: e.target.value })} /></div>
            <div><L>{t("ctl.escalation")}</L><input className={inp} type="number" value={debt.escalation_hours ?? ""} onChange={(e) => patch("cashdesk_debt", { escalation_hours: e.target.value })} /></div>
          </div>
          <SaveBtn k="cashdesk_debt" value={{ limit: num(debt.limit, 0), escalation_hours: num(debt.escalation_hours, 24) }} />
        </Card>

        {/* ALERT / REYTING (xodim tarafi) */}
        <Card icon={<Gauge size={16} />} title={t("ctl.alert")} side={t("ctl.alertSide")}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><L>{t("ctl.level2")}</L><input className={inp} type="number" value={alert.level2 ?? ""} onChange={(e) => patch("cashdesk_alert", { level2: e.target.value })} /></div>
            <div><L>{t("ctl.level3")}</L><input className={inp} type="number" value={alert.level3 ?? ""} onChange={(e) => patch("cashdesk_alert", { level3: e.target.value })} /></div>
            <div><L>{t("ctl.window")}</L><input className={inp} type="number" value={alert.window_hours ?? ""} onChange={(e) => patch("cashdesk_alert", { window_hours: e.target.value })} /></div>
          </div>
          <SaveBtn k="cashdesk_alert" value={{ level2: num(alert.level2, 3), level3: num(alert.level3, 5), window_hours: num(alert.window_hours, 24) }} />
        </Card>

        {/* JAMOA CHATI (xodim tarafi) */}
        <Card icon={<MessageSquare size={16} />} title={t("ctl.chatRules")} side={t("ctl.chatRulesSide")}>
          <textarea rows={4} className={inp} value={rules.text ?? ""} onChange={(e) => patch("team_chat_rules", { text: e.target.value })} />
          <div className="mt-3"><SaveBtn k="team_chat_rules" value={{ text: String(rules.text ?? "") }} /></div>
        </Card>

        {/* SOVRINLI KARTA / BONUS (mijoz tarafi) — to'liq forma admin/promo'da, bu yerda faqat holat */}
        <Card icon={<Trophy size={16} />} title={t("ctl.promo")} side={t("ctl.promoSide")}>
          <div className="mb-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium border ${
              promo.enabled ? "bg-[#4ADE80]/15 border-[#4ADE80]/40 text-[#4ADE80]" : "bg-[#FF6B85]/10 border-[#FF6B85]/30 text-[#FF6B85]"
            }`}>
              <Power size={13} /> {t("ctl.promoLabel")}: {promo.enabled ? t("ctl.on") : t("ctl.off")}
            </span>
            <p className="text-[10.5px] text-white/30 mt-2">{t("ctl.promoHint")}</p>
          </div>
          <Link href="/admin/promo" className="text-[12px] text-accent hover:underline">{t("ctl.goToPromo")}</Link>
        </Card>

        {/* SAYT (umumiy) */}
        <Card icon={<Wrench size={16} />} title={t("ctl.site")} side={t("ctl.siteSide")}>
          <div className="mb-3">
            <Toggle on={!!maint.enabled} label={t("ctl.maintenance")} onClick={() => patch("maintenance", { enabled: !maint.enabled })} />
            <p className="text-[10.5px] text-white/30 mt-2">{t("ctl.maintenanceHint")}</p>
          </div>
          <SaveBtn k="maintenance" value={{ enabled: !!maint.enabled }} />
        </Card>
      </div>
    </div>
  );
}
