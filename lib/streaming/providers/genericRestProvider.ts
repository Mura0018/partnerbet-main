import type { StreamingProvider, StreamInfo, ConnectionTestResult, StreamAvailability } from "@/lib/streaming/types";

// Default, documented contract this generic adapter expects from a
// provider's REST API:
//
//   GET {baseApiUrl}/status
//     Headers: X-Api-Key: <key>  (+ X-Api-Secret if configured)
//     200 OK = connected
//
//   GET {baseApiUrl}/streams/{externalStreamId}
//     Headers: X-Api-Key / X-Api-Secret
//     200 OK, body: { "stream_url": "https://...", "status": "live" | "scheduled" | "ended" }
//
// This is intentionally a REASONABLE DEFAULT for a REST-based provider,
// not a real named service's actual API. If a real, authorized streaming
// partner's API differs, add a dedicated class implementing
// StreamingProvider (see apiFootball.ts / sportmonks.ts in
// lib/football/providers/ for the established pattern) instead of
// changing this file.
const STATUS_MAP: Record<string, StreamAvailability> = {
  live: "available",
  available: "available",
  scheduled: "scheduled",
  ended: "ended",
  finished: "ended",
};

export class GenericRestStreamingProvider implements StreamingProvider {
  readonly id: string;
  readonly name: string;
  private baseApiUrl: string;
  private apiKey: string | null;
  private apiSecret: string | null;

  constructor(params: { id: string; name: string; baseApiUrl: string; apiKey: string | null; apiSecret: string | null }) {
    this.id = params.id;
    this.name = params.name;
    this.baseApiUrl = params.baseApiUrl.replace(/\/$/, "");
    this.apiKey = params.apiKey;
    this.apiSecret = params.apiSecret;
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers["X-Api-Key"] = this.apiKey;
    if (this.apiSecret) headers["X-Api-Secret"] = this.apiSecret;
    return headers;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${this.baseApiUrl}/status`, { headers: this.headers(), signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return { success: true, message: "Ulanish muvaffaqiyatli." };
      return { success: false, message: `Provayder ${res.status} bilan javob berdi.` };
    } catch (err: any) {
      return { success: false, message: err?.message ?? "Ulanib bo'lmadi." };
    }
  }

  async getStream(externalStreamId: string): Promise<StreamInfo | null> {
    try {
      const res = await fetch(`${this.baseApiUrl}/streams/${encodeURIComponent(externalStreamId)}`, {
        headers: this.headers(),
        next: { revalidate: 15 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.stream_url) return null;
      return {
        streamUrl: data.stream_url,
        availability: STATUS_MAP[data.status] ?? "unavailable",
      };
    } catch {
      return null;
    }
  }
}
