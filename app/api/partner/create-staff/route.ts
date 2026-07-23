import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isPartnerActive } from "@/lib/partner/status";

// Partner admin o'z hamkoriga xodim (staff) qo'shadi.
async function resolvePartnerAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: isAdmin } = await supabase.rpc("is_partner_admin");
  if (!isAdmin) return { ok: false as const, status: 403 };
  const { data: partnerId } = await supabase.rpc("current_partner_id");
  if (!partnerId) return { ok: false as const, status: 403 };
  if (!(await isPartnerActive(partnerId as string))) return { ok: false as const, status: 403 };
  return { ok: true as const, partnerId: partnerId as string };
}

export async function POST(req: NextRequest) {
  const check = await resolvePartnerAdmin();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const body = await req.json().catch(() => null);
  const { fullName, email, password } = body ?? {};
  if (!fullName || !email || !password) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const message = createError?.message?.includes("already been registered") ? "email_taken" : "create_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  await admin.from("profiles").update({ full_name: fullName }).eq("id", created.user.id);
  const { error: linkError } = await admin.from("partner_members").insert({
    partner_id: check.partnerId, profile_id: created.user.id, partner_role: "staff",
  });
  if (linkError) return NextResponse.json({ error: "link_failed", detail: linkError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
