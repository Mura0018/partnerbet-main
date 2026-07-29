import React from "react";

// The brand mark is "BET" in white + "CORE" in accent blue. If the admin
// configures a different site name, we just show it as plain text rather
// than guessing how to split an arbitrary string into two colors.
export function BrandName({ name, className = "" }: { name?: string | null; className?: string }) {
  if (name && name.trim().toUpperCase() !== "BETCORE") {
    return <span className={className}>{name}</span>;
  }
  return (
    <span className={className}>
      BET<span className="text-accent">CORE</span>
    </span>
  );
}
