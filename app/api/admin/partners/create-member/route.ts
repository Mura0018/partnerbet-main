import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createPartnerInvite } from "@/lib/partner/invite";

// Hamkorga a'zo (partner_admin yoki staff) yaratadi. Parol qo'yilmaydi —
// hamkor o'zi taklif havolasi orqali o'rnatadi. Faqat partners.manage.
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
  const { partnerId, fullName, email, partnerRole } = body ?? {};
  if (!partnerId || !fullName || !email) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const role = partnerRole === "partner_admin" ? "partner_admin" : "staff";

  const admin = createAdminClient();

  // Vaqtinchalik tasodifiy parol — hamkor o'zi taklif orqali almashtiradi.
  const tempPassword = crypto.randomBytes(24).toString("hex");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const message = createError?.message?.includes("already been registered") ? "email_taken" : "create_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await admin.from("profiles").update({ full_name: fullName }).eq("id", created.user.id);
  const { error: linkError } = await admin.from("partner_members").insert({
    partner_id: partnerId,
    profile_id: created.user.id,
    partner_role: role,
  });
  if (linkError) return NextResponse.json({ error: "link_failed", detail: linkError.message }, { status: 500 });

  let inviteUrl: string | null = null;
  try {
    inviteUrl = await createPartnerInvite(created.user.id);
  } catch { /* invite jadvali yo'q bo'lsa ham a'zo yaratildi */ }

  return NextResponse.json({ success: true, inviteUrl });
}
