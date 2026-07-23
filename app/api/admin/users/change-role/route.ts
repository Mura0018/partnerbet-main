import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { canAssignRole } from "@/lib/auth/roleAssign";

// Mavjud foydalanuvchi rolini o'zgartirish — SERVERDA, imtiyoz eskalatsiyasi
// tekshiruvi bilan. (Ilgari klientda to'g'ridan-to'g'ri supabase.update edi.)
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "users.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { userId, roleId } = (await req.json().catch(() => ({}))) ?? {};
  if (!userId || !roleId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  // Chaqiruvchi o'zidan teng yoki yuqori kuchli rol bera olmaydi.
  if (!(await canAssignRole(user.id, roleId))) {
    return NextResponse.json({ error: "forbidden_role_assignment" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role_id: roleId }).eq("id", userId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}
