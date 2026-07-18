import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

const ALLOWED_TABLES = ["posts", "football_news"] as const;

// Public endpoint: increments view_count for a published article. Uses
// the service-role client because posts/football_news RLS intentionally
// only grants public SELECT, not UPDATE — a visitor must not be able to
// write anything else on the row.
export async function POST(req: NextRequest) {
  let body: { table?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.table || !ALLOWED_TABLES.includes(body.table as any) || !body.id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`track-view:${ip}`, 60, 30);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from(body.table)
    .select("view_count")
    .eq("id", body.id)
    .eq("status", "published")
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase.from(body.table).update({ view_count: (row.view_count ?? 0) + 1 }).eq("id", body.id);
  return NextResponse.json({ success: true });
}
