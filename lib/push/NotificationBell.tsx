"use client";

import React, { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { getPushPermissionState, subscribeToPush, unsubscribeFromPush, isPushSupported } from "@/lib/push/subscribe";
import { toast } from "@/lib/ui/toast";

export function NotificationBell() {
  const [state, setState] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushPermissionState().then(setState);
  }, []);

  if (state === "loading" || state === "unsupported" || !isPushSupported()) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      if (state === "granted") {
        await unsubscribeFromPush();
        setState("default");
      } else {
        const result = await subscribeToPush();
        if (result.success) {
          setState("granted");
        } else {
          console.error("[push] Obuna yozilmadi:", result.error);
          toast.error("Bildirishnomaga obuna bo'lib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
          setState(await getPushPermissionState());
        }
      }
    } catch (err: any) {
      console.error("[push] Kutilmagan xato:", err);
      toast.error("Bildirishnomaga obuna bo'lib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
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
