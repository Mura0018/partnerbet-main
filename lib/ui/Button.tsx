import React from "react";
import Link from "next/link";

type Variant = "cta" | "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Reserved for real conversion actions: Download App, Claim Bonus, Open
  // Partner. Never used for generic UI actions — that's what keeps green
  // meaningful to the visitor.
  cta: "bg-gradient-to-r from-cta to-cta-dim text-white shadow-[0_0_24px_rgba(23,201,100,0.35)] hover:brightness-110",
  primary: "bg-gradient-to-r from-accent to-accent-dim text-white shadow-[0_0_24px_rgba(61,127,255,0.35)] hover:brightness-110",
  outline: "border border-white/15 text-white hover:bg-white/5",
  ghost: "text-muted hover:text-white hover:bg-white/5",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[12.5px] rounded-lg gap-1.5",
  md: "px-5 py-3 text-[14px] rounded-xl gap-2",
  lg: "px-7 py-3.5 text-[15px] rounded-xl gap-2",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
};

type ButtonAsButton = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsLink = CommonProps & { href: string; target?: string; rel?: string };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", children, className = "", icon, ...rest } = props;
  const cls = `inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;

  if ("href" in props && props.href) {
    const { href, target, rel } = props as ButtonAsLink;
    return (
      <Link href={href} target={target} rel={rel} className={cls}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon}
      {children}
    </button>
  );
}
