import React from "react";

// The brand mark is "WIN" in white + "ORA" in accent blue. If the admin
// configures a different site name, we just show it as plain text rather
// than guessing how to split an arbitrary string into two colors.
export function BrandName({ name, className = "" }: { name?: string | null; className?: string }) {
  if (name && name.trim().toUpperCase() !== "WINORA") {
    return <span className={className}>{name}</span>;
  }
  return (
    <span className={className}>
      WIN<span className="text-accent">ORA</span>
    </span>
  );
}
