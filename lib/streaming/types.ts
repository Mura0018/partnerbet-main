// Live Streaming provider abstraction. Exactly like lib/football/types.ts
// (Phase 3c), every provider adapter implements this SAME interface —
// the rest of the app (API routes, admin UI, public player) only ever
// talks to this contract, never to a provider's raw API shape directly.
//
// Unlike Football Data providers, no specific named streaming service is
// adapted here — see LIVE_STREAMING_ARCHITECTURE.md for why. The single
// GenericRestStreamingProvider below implements a documented, generic
// contract; a real provider with a non-conforming API gets its own
// adapter file later, still implementing this interface — no other code
// changes.

export type StreamAvailability = "available" | "scheduled" | "ended" | "unavailable";

export type StreamInfo = {
  streamUrl: string;
  availability: StreamAvailability;
};

export type ConnectionTestResult = {
  success: boolean;
  message: string;
};

export interface StreamingProvider {
  readonly id: string;   // streaming_providers.id
  readonly name: string;

  testConnection(): Promise<ConnectionTestResult>;
  getStream(externalStreamId: string): Promise<StreamInfo | null>;
}
