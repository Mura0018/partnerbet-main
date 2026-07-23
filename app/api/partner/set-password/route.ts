import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

// Hamkor taklif havolasi orqali O'Z parolini o'rnatadi (login talab qilinmaydi).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`partner-set-password:${ip}`, 3600, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { token, password } = (await req.json().catch(() => ({}))) ?? {};
  if (!token || !password) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("partner_invites")
    .select("id, profile_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at as string).getTime() < Date.now()) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(invite.profile_id as string, { password });
  if (updErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  await admin.from("partner_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
