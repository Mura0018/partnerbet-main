"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

// Butun tizim uchun sodda bildirishnoma (toast) tizimi.
// Ishlatish: import { toast } from "@/lib/ui/toast";  toast.success("...") / toast.error("...")
type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string };

let listeners: Array<(t: Toast[]) => void> = [];
let items: Toast[] = [];
let seq = 1;

function emit() {
  const snapshot = [...items];
  listeners.forEach((l) => l(snapshot));
}

function push(type: ToastType, message: string) {
  const id = seq++;
  items = [...items, { id, type, message }];
  emit();
  const ttl = type === "error" ? 7000 : 3500;
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ttl);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);

  useEffect(() => {
    const l = (t: Toast[]) => setList(t);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-[92%] max-w-sm pointer-events-none">
      {list.map((t) => {
        const cls = t.type === "success"
          ? "bg-[#0f2a1c] border-[#4ADE80]/40 text-[#c9f5db]"
          : t.type === "error"
          ? "bg-[#33121d] border-[#FF6B85]/40 text-[#ffd4dd]"
          : "bg-[#0e2038] border-accent/40 text-white";
        const Icon = t.type === "success" ? CheckCircle2 : t.type === "error" ? AlertTriangle : Info;
        const iconColor = t.type === "success" ? "text-[#4ADE80]" : t.type === "error" ? "text-[#FF6B85]" : "text-accent";
        return (
          <div key={t.id} className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex items-start gap-2.5 ${cls}`} style={{ animation: "toastIn .22s ease" }}>
            <Icon size={17} className={`shrink-0 mt-0.5 ${iconColor}`} />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Yopish"><X size={15} /></button>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
