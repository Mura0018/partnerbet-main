// Converts a "#RRGGBB" hex colour into the "R G B" space-separated form
// Tailwind's CSS-variable colour opacity syntax needs (see globals.css /
// tailwind.config.ts). Returns null for invalid input rather than
// injecting broken CSS.
export function hexToRgbTriplet(hex: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r} ${g} ${b}`;
}

export type ThemeSettings = {
  mode: "dark" | "light";
  accent_color?: string;
  secondary_color?: string;
  background_color?: string;
};

// Builds the CSS custom-property overrides for whichever colours the admin
// has actually customised, leaving the rest at their design-system default.
export function buildThemeCssVars(theme: ThemeSettings | null | undefined): string {
  if (!theme) return "";
  const overrides: string[] = [];

  const accentRgb = theme.accent_color ? hexToRgbTriplet(theme.accent_color) : null;
  if (accentRgb) overrides.push(`--color-accent: ${accentRgb};`);

  const secondaryRgb = theme.secondary_color ? hexToRgbTriplet(theme.secondary_color) : null;
  if (secondaryRgb) overrides.push(`--color-vip: ${secondaryRgb};`);

  const bgRgb = theme.background_color ? hexToRgbTriplet(theme.background_color) : null;
  if (bgRgb) overrides.push(`--color-bg: ${bgRgb};`);

  if (overrides.length === 0) return "";
  return `:root { ${overrides.join(" ")} }`;
}
