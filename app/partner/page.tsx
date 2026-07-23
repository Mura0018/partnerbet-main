"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Palette, Users, Receipt, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function PartnerDashboard() {
  const supabase = createClient();
  const [partner, setPartner] = useState<any>(null);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await supabase
        .from("partner_members")
        .select("partner_id, partners(*)")
        .eq("profile_id", user.id)
        .maybeSingle();
      const p = (mem as any)?.partners ?? null;
      setPartner(p);
      if ((mem as any)?.partner_id) {
        const { data: sa } = await supabase
          .from("partner_service_assignments")
          .select("enabled, partner_services(name)")
          .eq("partner_id", (mem as any).partner_id)
          .eq("enabled", true);
        setServices(((sa ?? []) as any[]).map((r) => r.partner_services?.name).filter(Boolean));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-[22px] font-bold mb-1">Xush kelibsiz{partner?.name ? `, ${partner.name}` : ""}</h1>
      <p className="text-[13px] text-muted mb-6">Panelingizni sozlang va ishni boshlang.</p>

      {/* Bot holati */}
      <div className={`rounded-xl border p-4 mb-4 flex items-center gap-3 ${partner?.bot_username ? "bg-[#4ADE80]/10 border-[#4ADE80]/30" : "bg-[#F4C76A]/10 border-[#F4C76A]/30"}`}>
        {partner?.bot_username ? <CheckCircle2 size={20} className="text-[#4ADE80] shrink-0" /> : <AlertTriangle size={20} className="text-[#F4C76A] shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{partner?.bot_username ? `Bot ulangan${partner?.bot_username ? ` — @${partner.bot_username}` : ""}` : "Bot hali ulanmagan"}</div>
          <div className="text-[11px] text-muted">{partner?.bot_username ? "Mijozlaringiz botingiz orqali kirmoqda." : "Boshlash uchun botingizni ulang."}</div>
        </div>
        {!partner?.bot_username && <Link href="/partner/bot" className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-[#F4C76A]/20 border border-[#F4C76A]/40 text-[#F4C76A] font-semibold">Ulash</Link>}
      </div>

      {/* Plan + xizmatlar */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-1">Tarif</div>
          <div className="text-[18px] font-bold">{partner?.plan === "premium" ? "Premium" : "Free"}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="text-[11px] text-muted mb-1">Yoqilgan xizmatlar</div>
          <div className="text-[18px] font-bold">{services.length}</div>
        </div>
      </div>

      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {services.map((s) => (
            <span key={s} className="text-[11.5px] px-2.5 py-1 rounded-full bg-accent/10 text-[#7db8ff] border border-accent/25">{s}</span>
          ))}
        </div>
      )}

      {/* Tez havolalar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: "/partner/bot", label: "Botni ulash", icon: Bot, d: "Telegram bot tokeningiz" },
          { href: "/partner/theme", label: "Tema tanlash", icon: Palette, d: "App ko'rinishi" },
          { href: "/partner/team", label: "Jamoa", icon: Users, d: "Xodim qo'shish" },
          { href: "/partner/billing", label: "Hisob", icon: Receipt, d: "To'lovlaringiz" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-accent/40">
            <q.icon size={18} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{q.label}</div>
              <div className="text-[11px] text-muted">{q.d}</div>
            </div>
            <ArrowRight size={16} className="text-muted group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}
