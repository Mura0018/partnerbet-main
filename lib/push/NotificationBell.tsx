"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { getPushPermissionState, subscribeToPush, unsubscribeFromPush, isPushSupported } from "@/lib/push/subscribe";

export function NotificationBell() {
  const [state, setState] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushPermissionState().then(setState);
  }, []);

  if (state === "loading" || state === "unsupported" || !isPushSupported()) return null;

  const handleClick = async () => {
    setBusy(true);
    if (state === "granted") {
      await unsubscribeFromPush();
      setState("default");
    } else {
      const result = await subscribeToPush();
      setState(result.success ? "granted" : await getPushPermissionState());
    }
    setBusy(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={state === "granted" ? "Bildirishnomalarni o'chirish" : "Bildirishnomalarni yoqish"}
      className="p-2 rounded-lg hover:bg-white/10 transition text-muted hover:text-white disabled:opacity-50"
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : state === "granted" ? <Bell size={16} className="text-accent" fill="currentColor" /> : <BellOff size={16} />}
    </button>
  );
}
