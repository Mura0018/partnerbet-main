import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createPartnerInvite } from "@/lib/partner/invite";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

// App'dagi "Hamkormisiz?" — hamkor o'z emaili orqali parol o'rnatish havolasini oladi.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`partner-request-invite:${ip}`, 3600, 8);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { email } = (await req.json().catch(() => ({}))) ?? {};
  if (!email || typeof email !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profileId } = await admin.rpc("partner_profile_by_email", { p_email: email.trim() });
  if (!profileId) return NextResponse.json({ error: "not_partner" }, { status: 404 });

  try {
    const inviteUrl = await createPartnerInvite(profileId as string);
    return NextResponse.json({ inviteUrl });
  } catch {
    return NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }
}
