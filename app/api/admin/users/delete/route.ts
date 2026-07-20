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

  return { ok: true as const, userId: user.id };
}

// Deletes the auth.users row via the Admin API — profiles.id references
// auth.users(id) on delete cascade (0003), so the profile row (and its
// role assignment) is removed automatically in the same operation.
export async function POST(req: NextRequest) {
  const check = await requireUsersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { userId } = body ?? {};
  if (!userId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (userId === check.userId) return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}
