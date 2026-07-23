import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createPartnerInvite } from "@/lib/partner/invite";

// Hamkor a'zosi uchun parol o'rnatish havolasini QAYTA hosil qiladi (tiklash).
// Faqat partners.manage.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "partners.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { profileId } = (await req.json().catch(() => ({}))) ?? {};
  if (!profileId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  // XAVFSIZLIK: faqat HAQIQIY hamkor a'zosi uchun havola yaratamiz — aks holda
  // partners.manage huquqiga ega admin platforma/super_admin hisobiga ham havola
  // yaratib, uni egallab olishi mumkin (imtiyoz eskalatsiyasi).
  const admin = createAdminClient();
  const { data: member } = await admin.from("partner_members").select("id").eq("profile_id", profileId).maybeSingle();
  if (!member) return NextResponse.json({ error: "not_a_partner_member" }, { status: 400 });

  try {
    const inviteUrl = await createPartnerInvite(profileId);
    return NextResponse.json({ inviteUrl });
  } catch (e: any) {
    return NextResponse.json({ error: "invite_failed", detail: e?.message }, { status: 500 });
  }
}
