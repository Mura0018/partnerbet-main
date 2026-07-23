// Mijoz mini-app temalari — dizayn tokenlari (CSS o'zgaruvchilari).
// Tema almashsa, bu qiymatlar :root ga yoziladi va butun app (fon, kartalar,
// tugmalar, chat ...) shunga qarab o'zgaradi. classic = bizning standart.
export const APP_THEMES: Record<string, Record<string, string>> = {
  classic: {
    "--t-bg": "linear-gradient(180deg,#123f77,#0f3364,#0a1a30)",
    "--t-card": "linear-gradient(180deg,#0e2038,#0a1a30)",
    "--t-btn": "linear-gradient(135deg,#3D7FFF,#4f6bff,#7c3aed)",
    "--t-card-shadow": "7px 7px 16px rgba(0,0,0,0.5),-4px -4px 12px rgba(120,180,255,0.08)",
    "--t-accent": "#3D7FFF",
  },
  neon: {
    "--t-bg": "linear-gradient(180deg,#06343b,#052429,#02171a)",
    "--t-card": "linear-gradient(180deg,#0a2b31,#05191c)",
    "--t-btn": "linear-gradient(135deg,#22d3ee,#3b82f6)",
    "--t-card-shadow": "0 0 20px rgba(34,211,238,0.18),7px 7px 16px rgba(0,0,0,0.55)",
    "--t-accent": "#22d3ee",
  },
  royal: {
    "--t-bg": "linear-gradient(180deg,#3a2f12,#2a2410,#141009)",
    "--t-card": "linear-gradient(180deg,#2a2410,#141009)",
    "--t-btn": "linear-gradient(135deg,#F4C76A,#c99a3e)",
    "--t-card-shadow": "7px 7px 16px rgba(0,0,0,0.55),-4px -4px 12px rgba(244,199,106,0.12)",
    "--t-accent": "#F4C76A",
  },
};

export function applyAppTheme(themeKey: string | null | undefined) {
  if (typeof document === "undefined") return;
  const t = APP_THEMES[themeKey ?? "classic"] ?? APP_THEMES.classic;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t)) root.style.setProperty(k, v);
}
