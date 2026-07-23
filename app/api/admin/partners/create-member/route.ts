import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Hamkorga a'zo (partner_admin yoki staff) yaratadi: auth user + partner_members bog'lash.
// Faqat platforma super admin (partners.manage) chaqira oladi.
async function requirePartnersManage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "partners.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  const check = await requirePartnersManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { partnerId, fullName, email, password, partnerRole } = body ?? {};
  if (!partnerId || !fullName || !email || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }
  const role = partnerRole === "partner_admin" ? "partner_admin" : "staff";

  const admin = createAdminClient();

  // 1) Auth user (profil handle_new_user trigger orqali 'user' roli bilan yaratiladi)
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

  // 2) Ism (profilda)
  await admin.from("profiles").update({ full_name: fullName }).eq("id", created.user.id);

  // 3) Hamkorga bog'lash
  const { error: linkError } = await admin.from("partner_members").insert({
    partner_id: partnerId,
    profile_id: created.user.id,
    partner_role: role,
  });
  if (linkError) {
    return NextResponse.json({ error: "link_failed", detail: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, userId: created.user.id });
}
