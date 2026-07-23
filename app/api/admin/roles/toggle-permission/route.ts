import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Rolga ruxsat berish/olib tashlash. Faqat roles.manage.
// XAVFSIZLIK:
//  - super_admin roli himoyalangan (o'zgartirib bo'lmaydi -> lockout yo'q).
//  - Chaqiruvchi O'Z rolini o'zgartira olmaydi (o'zini qulflab qo'ymaydi).
//  - Ruxsat BERISHDA chaqiruvchi o'sha ruxsatga EGA bo'lishi shart (roleAssign
//    tamoyili — "o'zingda yo'q narsani berma"; imtiyoz eskalatsiyasini oldini oladi).
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: canManage } = await supabase.rpc("has_permission", { perm_key: "roles.manage" });
  if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { roleId, permissionId, enabled } = (await req.json().catch(() => ({}))) ?? {};
  if (!roleId || !permissionId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();

  const { data: role } = await admin.from("roles").select("key").eq("id", roleId).maybeSingle();
  if (!role) return NextResponse.json({ error: "role_not_found" }, { status: 400 });
  if (role.key === "super_admin") return NextResponse.json({ error: "protected_role" }, { status: 403 });

  // Chaqiruvchining o'z roli — o'zini qulflab qo'ymaslik uchun taqiqlanadi.
  const { data: me } = await admin.from("profiles").select("role_id").eq("id", user.id).maybeSingle();
  if (me?.role_id === roleId) return NextResponse.json({ error: "cannot_edit_own_role" }, { status: 403 });

  const { data: perm } = await admin.from("permissions").select("key").eq("id", permissionId).maybeSingle();
  if (!perm) return NextResponse.json({ error: "permission_not_found" }, { status: 400 });

  if (enabled) {
    // Eskalatsiya himoyasi: faqat o'zingda bor ruxsatni bera olasan.
    const { data: callerHas } = await supabase.rpc("has_permission", { perm_key: perm.key });
    if (!callerHas) return NextResponse.json({ error: "cannot_grant_missing_permission" }, { status: 403 });
    await admin.from("role_permissions").upsert({ role_id: roleId, permission_id: permissionId }, { onConflict: "role_id,permission_id" });
  } else {
    await admin.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permissionId);
  }

  return NextResponse.json({ success: true });
}
