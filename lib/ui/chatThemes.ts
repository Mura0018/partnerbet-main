export type ChatThemeKey = "blue" | "green" | "purple" | "sunset" | "rose";

export const CHAT_THEMES: Record<ChatThemeKey, { label: string; from: string; to: string; swatch: string }> = {
  blue: { label: "Ko'k", from: "#3D7FFF", to: "#2456C9", swatch: "#3D7FFF" },
  green: { label: "Yashil", from: "#22C55E", to: "#15803D", swatch: "#22C55E" },
  purple: { label: "Binafsha", from: "#8B5CF6", to: "#6D28D9", swatch: "#8B5CF6" },
  sunset: { label: "Quyosh", from: "#F97316", to: "#C2410C", swatch: "#F97316" },
  rose: { label: "Pushti", from: "#F43F5E", to: "#BE123C", swatch: "#F43F5E" },
};

export const DEFAULT_CHAT_THEME: ChatThemeKey = "blue";

export function chatThemeGradient(theme: string | null | undefined): string {
  const t = CHAT_THEMES[(theme as ChatThemeKey) ?? DEFAULT_CHAT_THEME] ?? CHAT_THEMES.blue;
  return `linear-gradient(135deg, ${t.from}, ${t.to})`;
}
