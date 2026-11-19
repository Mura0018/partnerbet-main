import React from "react";

// The brand mark is "DED" in white + "PAY" in accent blue. If the admin
// configures a different site name, we just show it as plain text rather
// than guessing how to split an arbitrary string into two colors.
export function BrandName({ name, className = "" }: { name?: string | null; className?: string }) {
  if (name && name.trim().toUpperCase() !== "DEDPAY") {
    return <span className={className}>{name}</span>;
  }
  return (
    <span className={className}>
      DED<span className="text-accent">PAY</span>
    </span>
  );
}
