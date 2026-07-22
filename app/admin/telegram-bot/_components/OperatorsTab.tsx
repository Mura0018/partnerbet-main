"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, Users as UsersIcon, MapPin, MessageCircle, Send, CreditCard, Check, Loader2, X, Headset, CheckCircle2, AlertCircle, UserCheck, Search, Paperclip, ChevronLeft, Mic, Trash2, Reply, Palette, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Can } from "@/lib/auth/permissions";
import { useHistoryNav } from "@/lib/nav/useHistoryNav";
import { useVoiceRecorder, blobToBase64, formatDuration } from "@/lib/audio/useVoiceRecorder";
import { LuxuryCard } from "@/lib/ui/LuxuryCard";
import { chatThemeGradient } from "@/lib/ui/chatThemes";
import { ThemePicker } from "@/lib/ui/ThemePicker";

type OperatorRow = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  telegram_region: string | null;
  is_online: boolean;
};

const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";

export function OperatorsTab() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [regionDrafts, setRegionDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, is_active, telegram_region, is_online, roles!inner(key)")
      .eq("roles.key", "operator")
      .order("full_name");
    setOperators((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveRegion = async (id: string) => {
    const region = regionDrafts[id];
    if (region === undefined) return;
    setError(null);
    const { error } = await supabase.from("profiles").update({ telegram_region: region }).eq("id", id);
    if (error) { setError("Mintaqani saqlab bo'lmadi. Qayta urinib ko'ring."); return; }
    // Muvaffaqiyatli saqlangach draftni tozalaymiz — eski draftlar to'planmasin.
    setRegionDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  };

  const toggleActive = async (op: OperatorRow) => {
    setError(null);
    const { error } = await supabase.from("profiles").update({ is_active: !op.is_active }).eq("id", op.id);
    if (error) { setError("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring."); return; }
    load();
  };

  return (
    <div>
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 mb-5 text-[12px] text-muted leading-relaxed">
        Yangi operator qo'shish uchun avval <a href="/admin/users" className="text-accent">Foydalanuvchilar</a> bo'limida
        shaxsning rolini <span className="text-white font-medium">Operator</span> qilib belgilang — u shu ro'yxatda
        avtomatik paydo bo'ladi, so'ng mintaqasini shu yerda kiriting.
      </div>

      {error && (
        <p className="text-[12px] text-[#FF6B85] bg-[#FF6B85]/10 border border-[#FF6B85]/30 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {loading ? (
        <p className="text-[13px] text-muted">Yuklanmoqda...</p>
      ) : operators.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-[13px] text-muted">
          Hozircha Operator rolidagi foydalanuvchi yo'q.
        </div>
      ) : (
        <div className="space-y-3">
          {operators.map((op) => (
            <div key={op.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${op.is_online ? "bg-[#4ADE80]" : "bg-[#5b6f85]"}`} />
                  {op.full_name || "(ism kiritilmagan)"}
                </div>
                <div className="text-[11px] mt-0.5 text-muted">
                  Ish holati: <span className={op.is_online ? "text-[#4ADE80]" : "text-[#F4C76A]"}>{op.is_online ? "Faol" : "Band"}</span>
                  {" · "}Hisob: <span className={op.is_active ? "text-[#4ADE80]" : "text-[#5b6f85]"}>{op.is_active ? "Yoqilgan" : "O'chirilgan"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-muted shrink-0" />
                <input
                  className={inputCls}
                  placeholder="Mintaqa (masalan: Toshkent)"
                  defaultValue={op.telegram_region ?? ""}
                  onChange={(e) => setRegionDrafts((prev) => ({ ...prev, [op.id]: e.target.value }))}
                />
                <button onClick={() => saveRegion(op.id)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  Saqlash
                </button>
                <button onClick={() => toggleActive(op)} className="shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                  {op.is_active ? "O'chirish" : "Yoqish"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

