import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Operators can't read other staff's profiles directly (RLS only grants
// that to users.manage, which operators don't have) — but they DO need
// to see fellow operators' names to make sense of "who claimed this" /
// "who resolved this" in the orders list. This route bypasses RLS via
// service role but only exposes name + id, gated by the same
// telegram_orders.manage permission everyone here already has.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "telegram_orders.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: permission } = await admin.from("permissions").select("id").eq("key", "telegram_orders.manage").maybeSingle();
  if (!permission) return NextResponse.json({ operators: [] });

  const { data: rolePermissions } = await admin.from("role_permissions").select("role_id").eq("permission_id", permission.id);
  const roleIds = (rolePermissions ?? []).map((r) => r.role_id);
  if (roleIds.length === 0) return NextResponse.json({ operators: [] });

  const { data: staff } = await admin
    .from("profiles")
    .select("id, full_name, display_name")
    .in("role_id", roleIds)
    .eq("is_active", true);

  const operators = (staff ?? []).map((s) => ({ id: s.id, name: s.display_name || s.full_name || "(ism yo'q)" }));
  return NextResponse.json({ operators });
}
