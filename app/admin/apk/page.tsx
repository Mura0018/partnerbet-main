"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/lib/ui/useConfirm";

type Apk = {
  id: string; version: string; download_url: string; changelog: string;
  min_android: string; is_active: boolean; downloads_count: number;
};

export default function ApkManager() {
  const { t } = useLocale();
  const [releases, setReleases] = useState<Apk[]>([]);
  const [form, setForm] = useState({ version: "", download_url: "", changelog: "", min_android: "8.0" });
  const supabase = createClient();
  const { confirm, confirmDialog } = useConfirm();

  const load = async () => {
    const { data } = await supabase
      .from("apk_releases")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setReleases((data as Apk[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from("apk_releases").insert(form);
    setForm({ version: "", download_url: "", changelog: "", min_android: "8.0" });
    load();
  };

  const activate = async (id: string) => {
    await supabase.from("apk_releases").update({ is_active: false }).neq("id", id);
    await supabase.from("apk_releases").update({ is_active: true }).eq("id", id);
    load();
  };

  const remove = (id: string) => {
    confirm(t("cnt.apkConfirmDel"), async () => {
      // Soft delete: keeps the row (and its audit history) instead of erasing it.
      await supabase.from("apk_releases").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      load();
    });
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-[22px] font-bold mb-1">{t("cnt.apkTitle")}</h1>
      <p className="text-[13px] text-muted mb-6">{t("cnt.apkSub")}</p>

      <form onSubmit={add} className="rounded-xl glass-card p-5 mb-6 grid md:grid-cols-2 gap-3">
        <input required placeholder={t("cnt.apkPhVersion")} value={form.version}
          onChange={(e) => setForm({ ...form, version: e.target.value })}
          className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px]" />
        <input required placeholder={t("cnt.apkPhUrl")} value={form.download_url}
          onChange={(e) => setForm({ ...form, download_url: e.target.value })}
          className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px]" />
        <input placeholder={t("cnt.apkPhMin")} value={form.min_android}
          onChange={(e) => setForm({ ...form, min_android: e.target.value })}
          className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px]" />
        <input placeholder={t("cnt.apkPhLog")} value={form.changelog}
          onChange={(e) => setForm({ ...form, changelog: e.target.value })}
          className="bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px]" />
        <button type="submit" className="md:col-span-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dim font-semibold text-[13px]">
          <Plus size={15} /> {t("cnt.apkAdd")}
        </button>
      </form>

      <div className="space-y-3">
        {releases.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl glass-card p-4">
            <div>
              <div className="font-semibold text-[14px] flex items-center gap-2">
                v{r.version} {r.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/30">{t("cnt.apkActive")}</span>}
              </div>
              <div className="text-[12px] text-muted mt-1">{r.changelog}</div>
              <div className="text-[11px] text-[#5b6f85] mt-1">{r.downloads_count} {t("cnt.apkDownloads")} · Android {r.min_android}+</div>
            </div>
            <div className="flex gap-2">
              {!r.is_active && (
                <button onClick={() => activate(r.id)} className="p-2 rounded-md hover:bg-white/10" title={t("cnt.apkTipActivate")}>
                  <CheckCircle2 size={15} />
                </button>
              )}
              <button onClick={() => remove(r.id)} className="p-2 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </div>
  );
}
