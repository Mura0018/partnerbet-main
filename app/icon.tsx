import { ImageResponse } from "next/og";
import { createPublicServerClient } from "@/lib/supabasePublic";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function getCustomFaviconUrl(): Promise<string | null> {
  try {
    const supabase = createPublicServerClient();
    const { data } = await supabase.from("site_settings").select("value").eq("key", "branding").maybeSingle();
    return (data?.value as any)?.favicon_media_id_url ?? null;
  } catch {
    return null;
  }
}

export default async function Icon() {
  const customUrl = await getCustomFaviconUrl();

  if (customUrl) {
    try {
      const res = await fetch(customUrl);
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        const mimeType = res.headers.get("content-type") ?? "image/png";
        return new Response(bytes, { headers: { "content-type": mimeType } });
      }
    } catch {
      // Fall through to the generated default icon below.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #00A3FF, #1E90FF)",
          borderRadius: 7,
        }}
      >
        <div style={{ color: "white", fontSize: 18, fontWeight: 800, fontFamily: "sans-serif" }}>P</div>
      </div>
    ),
    { ...size }
  );
}
