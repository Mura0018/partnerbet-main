"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import React, { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Loader2, Trophy, Star, Video } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadImage } from "@/lib/media/upload";
import { isValidHttpUrl } from "@/lib/validation/url";

const inputCls = "w-full bg-white/5 border border-subtle rounded-lg py-2 px-3 text-[13px] text-white outline-none focus:border-accent";
type Tab = "leagues" | "fixtures" | "videos";

export default function FootballCenterAdmin() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("leagues");
  const TABS: { id: Tab; labelKey: string; icon: any }[] = [
    { id: "leagues", labelKey: "fbl.tabLeagues", icon: Trophy },
    { id: "fixtures", labelKey: "fbl.tabMatches", icon: Star },
    { id: "videos", labelKey: "fbl.tabVideos", icon: Video },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-[22px] font-bold mb-1">{t("fbl.title")}</h1>
      <p className="text-[13px] text-muted mb-6">
        Provayder va API kalitlarini <a href="/admin/settings" className="text-accent hover:underline">{t("fbl.sub")}</a> bo'limidan boshqaring.
        Bu yerda faqat tahririyat kontenti (ligalar tanlovi, ajratilgan o'yinlar, videolar) boshqariladi.
      </p>

      <div className="flex gap-1 mb-6 border-b border-subtle">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium border-b-2 transition ${tab === tb.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-white"}`}>
            <tb.icon size={14} /> {t(tb.labelKey as any)}
          </button>
        ))}
      </div>

      {tab === "leagues" && <FeaturedLeaguesTab />}
      {tab === "fixtures" && <FeaturedFixturesTab />}
      {tab === "videos" && <VideosTab />}
    </div>
  );
}

function FeaturedLeaguesTab() {
  const { t } = useLocale();
  const [leagues, setLeagues] = useState<any[]>([]);
  const [form, setForm] = useState({ provider: "api_football", external_league_id: "", name: "", country: "", season: "", position: 0 });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("featured_leagues").select("*").order("position");
    setLeagues(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.external_league_id.trim()) { setError("Nom va provayderdagi Liga ID kiriting."); return; }
    const { error: insertError } = await supabase.from("featured_leagues").insert(form);
    if (insertError) { setError(`Saqlashda xatolik: ${insertError.message}`); return; }
    setForm({ provider: "api_football", external_league_id: "", name: "", country: "", season: "", position: 0 });
    load();
  };
  const remove = async (id: string) => { await supabase.from("featured_leagues").delete().eq("id", id); load(); };

  return (
    <div>
      <p className="text-[12px] text-[#5b6f85] mb-4 leading-relaxed">
        Bu yerda tanlangan ligalar Football Center'dagi "League Tables" tanlovida ko'rinadi.
        Liga ID — tanlangan provayderning o'ziga xos identifikatori (masalan API-Football'da
        Premier League = 39).
      </p>
      <form onSubmit={add} className="rounded-xl glass-card p-5 mb-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select className={inputCls} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            <option value="api_football">API-Football</option>
            <option value="sportmonks">Sportmonks</option>
            <option value="football_data_org">Football-Data.org</option>
          </select>
          <input className={inputCls} placeholder={t("fbl.phLeagueId")} value={form.external_league_id} onChange={(e) => setForm({ ...form, external_league_id: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder={t("fbl.phName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder={t("fbl.phCountry")} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input className={inputCls} placeholder={t("fbl.phSeason")} value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
        </div>
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold"><Plus size={14} /> {t("fbl.add")}</button>
      </form>
      <div className="space-y-2">
        {leagues.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg border border-subtle p-3">
            <div className="text-[13px]"><span className="font-semibold">{l.name}</span> <span className="text-[#5b6f85] text-[12px]">· {l.provider} · ID {l.external_league_id} · {l.country} {l.season}</span></div>
            <button onClick={() => remove(l.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={14} /></button>
          </div>
        ))}
        {leagues.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-6">{t("fbl.noLeagues")}</p>}
      </div>
    </div>
  );
}

function FeaturedFixturesTab() {
  const { t } = useLocale();
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [form, setForm] = useState({ provider: "api_football", external_fixture_id: "", note: "", position: 0 });
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("featured_fixtures").select("*").order("position");
    setFixtures(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.external_fixture_id.trim()) { setError("O'yin ID kiriting."); return; }
    const { error: insertError } = await supabase.from("featured_fixtures").insert(form);
    if (insertError) { setError(`Saqlashda xatolik: ${insertError.message}`); return; }
    setForm({ provider: "api_football", external_fixture_id: "", note: "", position: 0 });
    load();
  };
  const remove = async (id: string) => { await supabase.from("featured_fixtures").delete().eq("id", id); load(); };

  return (
    <div>
      <p className="text-[12px] text-[#5b6f85] mb-4 leading-relaxed">
        Muayyan o'yinni "Featured" sifatida belgilash — o'yin ma'lumotlari provayderdan jonli
        olinadi, bu yerda faqat qaysi o'yin va tahririyat izohi saqlanadi.
      </p>
      <form onSubmit={add} className="rounded-xl glass-card p-5 mb-6 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select className={inputCls} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            <option value="api_football">API-Football</option>
            <option value="sportmonks">Sportmonks</option>
            <option value="football_data_org">Football-Data.org</option>
          </select>
          <input className={inputCls} placeholder={t("fbl.phFixtureId")} value={form.external_fixture_id} onChange={(e) => setForm({ ...form, external_fixture_id: e.target.value })} />
        </div>
        <input className={inputCls} placeholder={t("fbl.phEditorNote")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold"><Plus size={14} /> {t("fbl.add")}</button>
      </form>
      <div className="space-y-2">
        {fixtures.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-subtle p-3">
            <div className="text-[13px]">{f.provider} · ID {f.external_fixture_id} {f.note && <span className="text-[#5b6f85]"> — {f.note}</span>}</div>
            <button onClick={() => remove(f.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={14} /></button>
          </div>
        ))}
        {fixtures.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-6">{t("fbl.noFixtures")}</p>}
      </div>
    </div>
  );
}

function VideosTab() {
  const { t } = useLocale();
  const [videos, setVideos] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", video_url: "", description: "", is_featured: false });
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbMediaId, setThumbMediaId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase.from("football_videos").select("*").is("deleted_at", null).order("published_at", { ascending: false });
    setVideos(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const uploadThumb = async (file: File) => {
    setThumbUploading(true);
    try {
      const media = await uploadImage(file);
      setThumbMediaId(media.id);
    } catch (e: any) {
      setError(e.message ? `Yuklashda xatolik: ${e.message}` : "Yuklashda xatolik.");
    } finally {
      setThumbUploading(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !isValidHttpUrl(form.video_url)) { setError("Sarlavha va to'g'ri video URL kiriting."); return; }
    const { error: insertError } = await supabase.from("football_videos").insert({ ...form, thumbnail_media_id: thumbMediaId });
    if (insertError) { setError(`Saqlashda xatolik: ${insertError.message}`); return; }
    setForm({ title: "", video_url: "", description: "", is_featured: false });
    setThumbMediaId(null);
    load();
  };
  const remove = async (id: string) => { await supabase.from("football_videos").update({ deleted_at: new Date().toISOString() }).eq("id", id); load(); };

  return (
    <div>
      <form onSubmit={add} className="rounded-xl glass-card p-5 mb-6 space-y-2">
        <input className={inputCls} placeholder={t("fbl.phVideoTitle")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={inputCls} placeholder={t("fbl.phVideoUrl")} value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
        <textarea rows={2} className={inputCls} placeholder={t("fbl.phVideoDesc")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-subtle text-[12px] cursor-pointer hover:bg-white/5 w-fit">
          {thumbUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Thumbnail yuklash
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={thumbUploading} onChange={(e) => e.target.files?.[0] && uploadThumb(e.target.files[0])} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured</label>
        {error && <p className="text-[12px] text-[#FF6B85]">{error}</p>}
        <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-dim text-[12px] font-semibold"><Plus size={14} /> Video qo'shish</button>
      </form>
      <div className="space-y-2">
        {videos.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-subtle p-3">
            <div className="text-[13px] flex items-center gap-2">
              {v.is_featured && <Star size={12} className="text-vip" fill="currentColor" />}
              {v.title}
            </div>
            <button onClick={() => remove(v.id)} className="p-1.5 rounded-md hover:bg-white/10 text-[#FF6B85]"><Trash2 size={14} /></button>
          </div>
        ))}
        {videos.length === 0 && <p className="text-[12px] text-[#5b6f85] text-center py-6">{t("fbl.noVideos")}</p>}
      </div>
    </div>
  );
}
