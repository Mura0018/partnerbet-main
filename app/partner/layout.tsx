"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Bot, Palette, Users, Receipt, LogOut, Menu, X, Building2, MessageCircle, CreditCard, ListOrdered } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Toaster } from "@/lib/ui/toast";

const NAV = [
  { href: "/partner", label: "Boshqaruv", icon: LayoutDashboard },
  { href: "/partner/orders", label: "Buyurtmalar", icon: ListOrdered },
  { href: "/partner/bot", label: "Bot", icon: Bot },
  { href: "/partner/theme", label: "Tema", icon: Palette },
  { href: "/partner/payments", label: "To'lov usullari", icon: CreditCard },
  { href: "/partner/team", label: "Jamoa", icon: Users },
  { href: "/partner/billing", label: "Hisob", icon: Receipt },
  { href: "/partner/chat", label: "Global chat", icon: MessageCircle },
];

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partner, setPartner] = useState<{ name?: string; plan?: string; role?: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("partner_members")
        .select("partner_role, partners(name, plan)")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (data) setPartner({ ...(data.partners as any), role: data.partner_role });
    })();
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const logout = async () => { await supabase.auth.signOut(); router.push("/auth/login"); router.refresh(); };

  const isStaff = partner?.role === "staff";
  const nav = isStaff ? NAV.filter((n) => ["/partner", "/partner/orders", "/partner/billing", "/partner/chat"].includes(n.href)) : NAV;

  const sidebar = (
    <>
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/8 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold truncate">{partner?.name || "Hamkor"}</div>
          <div className="text-[10px] text-muted">{partner?.plan === "premium" ? "Premium" : "Free"} · {isStaff ? "Xodim" : "Admin"}</div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden ml-auto p-1.5 rounded-lg hover:bg-white/10" aria-label="Yopish"><X size={18} /></button>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = item.href === "/partner" ? pathname === "/partner" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition ${active ? "text-white bg-accent/20" : "text-muted hover:text-white hover:bg-white/5"}`}>
              <item.icon size={16} /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/8 shrink-0">
        <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#FF6B85] hover:bg-[#FF3B5C]/10">
          <LogOut size={16} /> Chiqish
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100svh] bg-bg text-white md:flex overflow-x-hidden">
      <div className="md:hidden h-14 flex items-center justify-between px-4 border-b border-white/8 bg-panel/40 sticky top-0 z-30">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-white/10" aria-label="Menyu"><Menu size={20} /></button>
        <span className="font-bold text-[13px] truncate">{partner?.name || "Hamkor paneli"}</span>
        <div className="w-9" />
      </div>

      {open && <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-60 shrink-0 border-r border-white/8 bg-bg-elevated md:bg-panel/40 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {sidebar}
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">{children}</main>
      <Toaster />
    </div>
  );
}
