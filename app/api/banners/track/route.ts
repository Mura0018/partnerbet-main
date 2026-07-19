import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  let body: { id?: string; action?: "view" | "click" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.id || (body.action !== "view" && body.action !== "click")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`banner-track:${ip}`, 60, 60);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const supabase = createAdminClient();
  const column = body.action === "view" ? "views" : "clicks";
  const { data: row } = await supabase.from("advertisements").select(column).eq("id", body.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase.from("advertisements").update({ [column]: ((row as any)[column] ?? 0) + 1 }).eq("id", body.id);
  return NextResponse.json({ success: true });
}
