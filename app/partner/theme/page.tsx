"use client";

import React, { useEffect, useState } from "react";
import { Palette, Check, Lock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/lib/ui/toast";

export default function PartnerThemePage() {
  const supabase = createClient();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [current, setCurrent] = useState("classic");
  const [role, setRole] = useState("");
  const [themes, setThemes] = useState<any[]>([]);
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await supabase.from("partner_members").select("partner_id, partner_role, partners(theme_key)").eq("profile_id", user.id).maybeSingle();
      const pid = (mem as any)?.partner_id ?? null;
      setPartnerId(pid);
      setRole((mem as any)?.partner_role ?? "");
      setCurrent((mem as any)?.partners?.theme_key ?? "classic");
      const [{ data: th }, { data: ta }] = await Promise.all([
        supabase.from("app_themes").select("id, key, name, is_premium, accent").eq("is_active", true).order("sort"),
        pid ? supabase.from("partner_theme_access").select("theme_id, enabled").eq("partner_id", pid) : Promise.resolve({ data: [] as any[] }),
      ]);
      setThemes(th ?? []);
      const am: Record<string, boolean> = {};
      for (const r of ((ta as any[]) ?? [])) am[r.theme_id] = r.enabled;
      setAccess(am);
      setLoading(false);
    })();
  }, []);

  const isAdmin = role === "partner_admin";
  const canUse = (t: any) => !t.is_premium || access[t.id];

  const choose = async (t: any) => {
    if (!isAdmin || !canUse(t) || !partnerId) return;
    setSaving(t.key);
    const { error } = await supabase.from("partners").update({ theme_key: t.key }).eq("id", partnerId);
    setSaving(null);
    if (!error) { setCurrent(t.key); toast.success(`"${t.name}" temasi tanlandi ✅`); }
    else toast.error("Saqlashda xatolik: " + error.message);
  };

  if (loading) return <div className="p-6 text-[13px] text-muted">Yuklanmoqda...</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Palette size={20} className="text-accent" />
        <h1 className="text-[22px] font-bold">Tema</h1>
      </div>
      <p className="text-[13px] text-muted mb-6">App ko'rinishini tanlang. Premium temalar to'lov asosida ochiladi.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {themes.map((t) => {
          const active = current === t.key;
          const locked = t.is_premium && !access[t.id];
          return (
            <button key={t.id} onClick={() => choose(t)} disabled={!isAdmin || locked || saving !== null}
              className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition ${active ? "border-accent bg-accent/10" : "border-white/8 bg-white/[0.02]"} ${(!isAdmin || locked) ? "opacity-70 cursor-not-allowed" : "hover:border-accent/40"}`}>
              <span className="w-9 h-9 rounded-xl shrink-0" style={{ background: t.accent || "#3D7FFF" }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold flex items-center gap-1.5">{t.name} {locked && <Lock size={12} className="text-[#F4C76A]" />}</div>
                <div className="text-[11px] text-muted">{t.is_premium ? (locked ? "Premium — yopiq" : "Premium — ochiq") : "Bepul"}</div>
              </div>
              {saving === t.key ? <Loader2 size={16} className="animate-spin text-accent" /> : active && <Check size={18} className="text-accent shrink-0" />}
            </button>
          );
        })}
      </div>

      {!isAdmin && <p className="text-[12px] text-muted mt-4">Temani faqat partner admin o'zgartira oladi.</p>}
    </div>
  );
}
