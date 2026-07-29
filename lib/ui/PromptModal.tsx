"use client";

import React, { useEffect, useState } from "react";

// Oddiy forma maydoni — window.prompt() o'rniga. Mavzuga mos, dark
// theme'da to'g'ri ko'rinadi.
export function PromptModal({
  open,
  title,
  placeholder,
  defaultValue = "",
  confirmLabel = "OK",
  cancelLabel = "Bekor qilish",
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

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
        <div className="text-[14px] font-semibold mb-3">{title}</div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(value);
            if (e.key === "Escape") onCancel();
          }}
          className="w-full bg-white/5 border border-subtle rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-accent mb-4"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg text-[13px] text-muted hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(value)}
            className="px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-accent-dim"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
