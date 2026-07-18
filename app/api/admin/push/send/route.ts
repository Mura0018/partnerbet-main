import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendPushToAllSubscribers } from "@/lib/push/sendPush";
import { checkAndRecordRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "settings.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // A broadcast reaches every subscriber at once — rate-limited per-admin
  // to prevent an accidental double-click (or a compromised session) from
  // spamming the whole subscriber list repeatedly.
  const { allowed: withinLimit } = await checkAndRecordRateLimit(`push-send:${user.id}`, 300, 3);
  if (!withinLimit) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: { title?: string; body?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await sendPushToAllSubscribers(body.title.trim(), body.body.trim(), body.url?.trim());

    const admin = createAdminClient();
    await admin.from("push_notification_log").insert({
      title: body.title.trim(),
      body: body.body.trim(),
      url: body.url?.trim() || null,
      sent_by: user.id,
      recipients_count: result.recipients,
      failures_count: result.failures,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "send_failed" }, { status: 500 });
  }
}
