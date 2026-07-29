"use client";

import React from "react";

// Mavzuga mos tasdiqlash oynasi — window.confirm() o'rniga. Amal FAQAT
// "Tasdiqlash" tugmasi bosilganda ishga tushadi; oynani yopish yoki
// "Bekor qilish" hech narsa qilmaydi.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-5"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-subtle bg-panel p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="text-[14px] font-semibold mb-2">{title}</div>}
        <div className="text-[13px] text-muted leading-relaxed mb-5">{message}</div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3.5 py-2 rounded-lg text-[13px] text-muted hover:bg-white/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 ${
              danger ? "bg-[#FF6B85] text-white hover:bg-[#ff5577]" : "bg-accent text-white hover:bg-accent-dim"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
