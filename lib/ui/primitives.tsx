import React from "react";

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-7xl mx-auto px-5 md:px-8 ${className}`}>{children}</div>;
}

export function Card({
  children, className = "", as: As = "div", premium = true, style,
}: { children: React.ReactNode; className?: string; as?: any; premium?: boolean; style?: React.CSSProperties }) {
  return <As className={`rounded-2xl ${premium ? "card-premium" : "border border-white/8 bg-white/[0.02]"} ${className}`} style={style}>{children}</As>;
}

export function SectionHeading({
  eyebrow, title, action,
}: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        {eyebrow && <div className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase mb-1.5">{eyebrow}</div>}
        <h2 className="text-[22px] md:text-[26px] font-extrabold text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

type BadgeTone = "blue" | "green" | "gold" | "live" | "neutral";
const BADGE_TONES: Record<BadgeTone, string> = {
  blue: "bg-accent/10 text-[#8EB6FF] border-accent/25",
  green: "bg-cta/10 text-[#5EE896] border-cta/25",
  gold: "bg-vip/10 text-vip border-vip/25",
  live: "bg-danger/10 text-[#FF8BA3] border-danger/25",
  neutral: "bg-white/5 text-muted border-white/10",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${BADGE_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, message, hint }: { icon?: React.ReactNode; message: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
      {icon && <div className="w-11 h-11 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-4 text-muted">{icon}</div>}
      <p className="text-[14px] font-medium text-white mb-1">{message}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}
