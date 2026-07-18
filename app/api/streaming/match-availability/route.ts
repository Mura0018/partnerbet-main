import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Public: tells the site whether an official stream exists for a match,
// and which provider(s) — WITHOUT exposing base_api_url, keys, or any
// other internal provider detail. Only `id` and `name` are selected.
export async function GET(req: NextRequest) {
  const footballProvider = req.nextUrl.searchParams.get("footballProvider");
  const externalFixtureId = req.nextUrl.searchParams.get("fixtureId");

  if (!footballProvider || !externalFixtureId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: streams } = await supabase
    .from("match_streams")
    .select("id, is_primary, starts_at, ends_at, streaming_providers(id, name, is_active)")
    .eq("football_provider", footballProvider)
    .eq("external_fixture_id", externalFixtureId)
    .eq("is_active", true);

  const available = (streams ?? []).filter((s: any) => {
    if (!s.streaming_providers?.is_active) return false;
    if (s.starts_at && s.starts_at > now) return false;
    if (s.ends_at && s.ends_at < now) return false;
    return true;
  });

  if (available.length === 0) {
    return NextResponse.json({ available: false, providers: [] });
  }

  const providers = available
    .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
    .map((s: any) => ({ matchStreamId: s.id, providerId: s.streaming_providers.id, providerName: s.streaming_providers.name, isPrimary: s.is_primary }));

  return NextResponse.json({ available: true, providers });
}
