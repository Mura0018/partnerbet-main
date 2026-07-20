import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkAndRecordRateLimit, getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkAndRecordRateLimit(`telegram-reset-confirm:${ip}`, 300, 10);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const { phone, code, newPassword } = body ?? {};
  if (!phone || !code || !newPassword) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, reset_code_hash, reset_code_expires_at")
    .eq("phone", String(phone).trim())
    .maybeSingle();

  if (!customer?.reset_code_hash || !customer.reset_code_expires_at) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (new Date(customer.reset_code_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  const codeOk = await bcrypt.compare(String(code).trim(), customer.reset_code_hash);
  if (!codeOk) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const newHash = await bcrypt.hash(String(newPassword), 10);
  await supabase
    .from("customers")
    .update({ password_hash: newHash, reset_code_hash: null, reset_code_expires_at: null })
    .eq("id", customer.id);

  return NextResponse.json({ success: true });
}
