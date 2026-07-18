import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { runLinkHealthCheck } from "@/lib/affiliates/runLinkHealthCheck";

// Manual "Check Links" trigger from the admin panel.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promotions.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { partnerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine — checks every active partner
  }

  const result = await runLinkHealthCheck(body.partnerId);
  return NextResponse.json(result);
}
