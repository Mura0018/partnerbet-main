import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/auth/rateLimit";

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; rememberMe?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const rememberMe = body.rememberMe !== false; // default true
  if (!email || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  // --- Brute-force protection ---
  const rateLimit = await checkLoginRateLimit(email, ip);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMinutes: rateLimit.retryAfterMinutes },
      { status: 429 }
    );
  }

  const supabase = await createServerSupabaseClient({ persistSession: rememberMe });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.log("LOGIN ERROR:", error);
    await recordLoginAttempt(email, ip, userAgent, false);
    const code = error.message.toLowerCase().includes("email not confirmed")
      ? "email_not_confirmed"
      : "invalid_credentials";
    return NextResponse.json({ error: code }, { status: 401 });
  }

  await recordLoginAttempt(email, ip, userAgent, true);

  // Best-effort last_login_at update — never block a successful login on this.
  if (data.user) {
    await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
  }

  return NextResponse.json({ success: true });
}
