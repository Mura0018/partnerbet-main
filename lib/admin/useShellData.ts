"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// /api/admin/shell javob shakli (0-bosqich endpoint'i bilan mos).
export type ShellData = {
  shell: boolean;
  isPartner?: boolean;
  role?: string | null;
  perms?: string[];
  canManageOrders?: boolean;
  canOversight?: boolean;
  me?: { name: string; rating: number; isBusy: boolean; busyReason: string | null; isOnline: boolean };
  counts?: {
    pendingOrders: number;
    openDebts: number;
    onlineOperators: number;
    totalOperators: number;
    teamChatLatestAt: string | null;
    teamChatTotal: number;
    cashdesksLow: number | null;
  };
  balance?: { configured: boolean; balance: number | null; limit: number | null } | null;
  deskName?: string | null;
  slaDeadline?: string | null;
};

// Yagona poll manbai — sidebar badge'lari ham, hero karta ham shundan oladi
// (takror poll bo'lmaydi). Sahifa yashiringanda (background tab) so'rov to'xtaydi.
export function useShellData(intervalMs = 30000) {
  const [data, setData] = useState<ShellData | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/shell", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {
      /* tarmoq — eski qiymat qoladi */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(() => {
      if (!document.hidden) load();
    }, intervalMs);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, intervalMs]);

  return { data, loading, refresh: load };
}
