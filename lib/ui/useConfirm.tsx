"use client";

import React, { useCallback, useState } from "react";
import { ConfirmDialog } from "@/lib/ui/ConfirmDialog";

// window.confirm() ni almashtiruvchi hook. `confirm(message, action)`
// darhol `action`ni chaqirmaydi — faqat oynani ochadi. `action` FAQAT
// foydalanuvchi "Tasdiqlash" tugmasini bosganda ishga tushadi. Oynani
// yopish/bekor qilish `action`ni umuman chaqirmaydi.
export function useConfirm() {
  const [pending, setPending] = useState<{ message: string; action: () => void | Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((message: string, action: () => void | Promise<void>) => {
    setPending({ message, action });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.action();
    } finally {
      setBusy(false);
      setPending(null);
    }
  }, [pending]);

  const confirmDialog = (
    <ConfirmDialog
      open={!!pending}
      message={pending?.message ?? ""}
      busy={busy}
      onConfirm={handleConfirm}
      onCancel={() => setPending(null)}
    />
  );

  return { confirm, confirmDialog };
}
