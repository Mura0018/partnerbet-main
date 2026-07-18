import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getStreamingProviderById } from "@/lib/streaming/registry";

const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "streaming.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { providerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.providerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();

  // --- Rate limit: prevents a "Test Connection" button from being spammed ---
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("streaming_connection_logs")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", body.providerId)
    .eq("event_type", "test_connection")
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const provider = await getStreamingProviderById(body.providerId);
  if (!provider) {
    return NextResponse.json({ error: "provider_not_found" }, { status: 404 });
  }

  const result = await provider.testConnection();

  await Promise.all([
    admin.from("streaming_connection_logs").insert({
      provider_id: body.providerId,
      event_type: "test_connection",
      success: result.success,
      message: result.message,
    }),
    admin
      .from("streaming_providers")
      .update({
        connection_status: result.success ? "connected" : "error",
        last_sync_at: new Date().toISOString(),
        last_error: result.success ? null : result.message,
      })
      .eq("id", body.providerId),
  ]);

  return NextResponse.json(result);
}
