"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Contact, ClipboardList, Pause, MessageCircle, UserCircle } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type NavItem = { href: string; labelKey: string; icon: any; permission: string | null };
type NavGroup = { id: string; color: string; labelKey: string; items: NavItem[] };

// ⌘K command palette — bo'lim qidirish (ruxsat bo'yicha filtrlangan),
// mijoz/buyurtma ID yorliqlari va tezkor amallar. Klaviaturasiz ham ishlaydi.
export function CommandPalette({
  groups,
  perms,
  onClose,
  onToggleBusy,
}: {
  groups: NavGroup[];
  perms: string[] | undefined;
  onClose: () => void;
  onToggleBusy: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const can = (p: string | null) => p == null || (perms ?? []).includes(p);
  const query = q.trim().toLowerCase();

  // Bo'limlar (ruxsat + matn bo'yicha)
  const sections = useMemo(() => {
    const out: { item: NavItem; color: string }[] = [];
    for (const g of groups) {
      for (const it of g.items) {
        if (!can(it.permission)) continue;
        const label = t(it.labelKey as any).toLowerCase();
        if (!query || label.includes(query)) out.push({ item: it, color: g.color });
      }
    }
    return out;
  }, [groups, perms, query, t]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const isNumeric = /^\d{3,}$/.test(query);

  const actions = [
    { key: "busy", icon: Pause, label: t("shl.actBusy"), color: "#FFB020", run: () => { onToggleBusy(); onClose(); } },
    { key: "chat", icon: MessageCircle, label: t("shl.actChat"), color: "#8B5CFF", run: () => go("/admin/telegram-bot?chat=1") },
    { key: "profile", icon: UserCircle, label: t("shl.actProfile"), color: "#7D8CA6", run: () => go("/admin/profile") },
  ].filter((a) => !query || a.label.toLowerCase().includes(query));

  const nothing = sections.length === 0 && actions.length === 0 && !isNumeric;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-lg mx-auto mt-[8vh] px-4 flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
        {/* qidiruv qatori */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center text-muted bg-white/[0.07] shrink-0" aria-label="Yopish">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-xl bg-[#12233c]" style={{ boxShadow: "0 0 0 1.5px #2E8FFF, 0 0 22px rgba(46,143,255,.3)" }}>
            <Search size={15} className="text-[#2E8FFF] shrink-0" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("shl.searchPh")}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14.5px] text-white placeholder:text-muted"
              autoComplete="off"
            />
          </div>
        </div>

        {/* natijalar */}
        <div className="overflow-y-auto rounded-2xl bg-[#0b1524]/90 border border-subtle p-2">
          {isNumeric && (
            <>
              <div className="px-2 pt-2 pb-1 text-[9.5px] font-bold tracking-[0.14em] uppercase text-muted">{t("shl.secDirect")}</div>
              <Row icon={Contact} color="#12D9A0" label={t("shl.custId", { id: query })} onClick={() => go(`/admin/customers?q=${query}`)} />
              <Row icon={ClipboardList} color="#12D9A0" label={t("shl.orderId", { id: query })} onClick={() => go(`/admin/telegram-bot?order=${query}`)} />
            </>
          )}

          {actions.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1 text-[9.5px] font-bold tracking-[0.14em] uppercase text-muted">{t("shl.secActions")}</div>
              {actions.map((a) => (
                <Row key={a.key} icon={a.icon} color={a.color} label={a.label} onClick={a.run} />
              ))}
            </>
          )}

          {sections.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1 text-[9.5px] font-bold tracking-[0.14em] uppercase text-muted">{t("shl.secSections")}</div>
              {sections.map(({ item, color }) => (
                <Row key={item.href} icon={item.icon} color={color} label={t(item.labelKey as any)} onClick={() => go(item.href)} />
              ))}
            </>
          )}

          {nothing && <div className="text-center py-10 px-6 text-muted text-[13.5px]">{t("shl.empty", { q })}</div>}
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, color, label, onClick }: { icon: any; color: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left text-[14px] text-white hover:bg-white/[0.06] active:scale-[0.99] transition">
      <Icon size={18} className="shrink-0" style={{ color, filter: `drop-shadow(0 0 6px ${color}88)` }} />
      <span className="flex-1 min-w-0 truncate">{label}</span>
    </button>
  );
}
