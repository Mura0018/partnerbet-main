import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
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

  try {
    const inviteUrl = await createPartnerInvite(profileId);
    return NextResponse.json({ inviteUrl });
  } catch (e: any) {
    return NextResponse.json({ error: "invite_failed", detail: e?.message }, { status: 500 });
  }
}
