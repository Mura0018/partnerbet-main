import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

async function requireUsersManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "users.manage" });
  if (!allowed) return { ok: false as const, status: 403 };

  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const check = await requireUsersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { fullName, email, password, roleId } = body ?? {};
  if (!fullName || !email || !password || !roleId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const message = createError?.message?.includes("already been registered") ? "email_taken" : "create_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: roleError } = await admin.from("profiles").update({ role_id: roleId, full_name: fullName }).eq("id", created.user.id);
  if (roleError) {
    return NextResponse.json({ error: "role_assign_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: created.user.id });
}
