import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "security.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { ip, action, reason } = body ?? {};
  if (!ip || !["block", "unblock"].includes(action)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (action === "block") {
    await admin.from("blocked_ips").upsert(
      { ip_address: ip, reason: reason ? String(reason).slice(0, 300) : null, blocked_by: user.id, blocked_at: new Date().toISOString(), expires_at: null },
      { onConflict: "ip_address" }
    );
  } else {
    await admin.from("blocked_ips").delete().eq("ip_address", ip);
  }

  return NextResponse.json({ success: true });
}
