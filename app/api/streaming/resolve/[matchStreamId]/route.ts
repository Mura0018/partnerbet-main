import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getStreamingProviderById } from "@/lib/streaming/registry";

// Public: resolves the actual playable stream URL for a match_streams row
// at click-time (not cached in the availability check) — the URL itself
// may be short-lived/signed by the provider, so it's fetched fresh here.
export async function GET(req: NextRequest, { params }: { params: Promise<{ matchStreamId: string }> }) {
  const { matchStreamId } = await params;

  const supabase = createAdminClient();
  const { data: matchStream } = await supabase
    .from("match_streams")
    .select("id, streaming_provider_id, external_stream_id, external_fixture_id, is_active, starts_at, ends_at")
    .eq("id", matchStreamId)
    .eq("is_active", true)
    .maybeSingle();

  if (!matchStream) {
    return NextResponse.json({ available: false, error: "not_found" }, { status: 404 });
  }

  const now = new Date();
  if (matchStream.starts_at && new Date(matchStream.starts_at) > now) {
    return NextResponse.json({ available: false, error: "not_started" });
  }
  if (matchStream.ends_at && new Date(matchStream.ends_at) < now) {
    return NextResponse.json({ available: false, error: "ended" });
  }

  const provider = await getStreamingProviderById(matchStream.streaming_provider_id);
  if (!provider) {
    return NextResponse.json({ available: false, error: "provider_unavailable" });
  }

  const streamIdentifier = matchStream.external_stream_id || matchStream.external_fixture_id;
  const stream = await provider.getStream(streamIdentifier);

  if (!stream || stream.availability === "unavailable") {
    return NextResponse.json({ available: false, error: "stream_unavailable" });
  }

  return NextResponse.json({ available: true, streamUrl: stream.streamUrl, status: stream.availability });
}
