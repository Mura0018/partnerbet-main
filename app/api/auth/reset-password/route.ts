import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkPasswordStrength } from "@/lib/auth/password";

// Parol tiklash — recovery sessiyasi tokeni bilan. Parol kuchi SERVER
// tomonда majburlanadi (client updateUser bypass'ini yopadi). accessToken
// email havolаsидан kelган recovery sessiya tokeni.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessToken = body?.accessToken;
  const password = body?.password;
  if (!accessToken || !password) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();

  // Recovery tokenини tekshirib, foydalanuvchини aniqlaymiz.
  const { data: u, error: uErr } = await admin.auth.getUser(String(accessToken));
  if (uErr || !u?.user) return NextResponse.json({ error: "invalid_session" }, { status: 401 });

  // Parol siyosati (10 belgi + harf/raqam/belgi) — SERVER tomonда.
  const strength = checkPasswordStrength(String(password), u.user.email ?? undefined);
  if (!strength.valid) return NextResponse.json({ error: "weak_password", failedRules: strength.failedRules }, { status: 400 });

  const { error } = await admin.auth.admin.updateUserById(u.user.id, { password: String(password) });
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
