import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { checkPasswordStrength } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const strength = checkPasswordStrength(newPassword, user.email);
  if (!strength.valid) {
    return NextResponse.json({ error: "weak_password", failedRules: strength.failedRules }, { status: 400 });
  }

  // Confirm identity by re-authenticating with the CURRENT password before
  // allowing the change — an active session alone is not proof of knowing
  // the current password (e.g. a shared/left-open browser tab).
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return NextResponse.json({ error: "wrong_current_password" }, { status: 401 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: "generic_error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
