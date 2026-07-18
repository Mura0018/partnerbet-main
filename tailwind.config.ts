import type { Config } from "tailwindcss";

// Colours are defined as CSS custom properties (see app/globals.css for
// defaults) so the admin-configured Theme Colors (Site Settings, Phase 3)
// can override them at runtime via a small inline <style> tag injected by
// the root layout — no rebuild/redeploy needed when an admin changes them.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
          panel: "rgb(var(--color-bg-panel) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          dim: "rgb(var(--color-accent-dim) / <alpha-value>)",
        },
        cta: {
          DEFAULT: "rgb(var(--color-cta) / <alpha-value>)",
          dim: "rgb(var(--color-cta-dim) / <alpha-value>)",
        },
        vip: "rgb(var(--color-vip) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
