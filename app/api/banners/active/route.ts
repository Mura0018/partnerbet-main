import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get("placement");
  const size = req.nextUrl.searchParams.get("size");
  if (!placement) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("advertisements")
    .select("id, kind, image_url, embed_code, target_url, partner_id, banner_size")
    .is("deleted_at", null)
    .eq("is_active", true)
    .eq("placement", placement)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (size) query = query.eq("banner_size", size);

  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) return NextResponse.json({ banner: null });

  const banner = candidates[Math.floor(Math.random() * candidates.length)];

  let partnerSlug: string | null = null;
  if (banner.partner_id) {
    const { data: partner } = await supabase
      .from("affiliate_partners")
      .select("slug")
      .eq("id", banner.partner_id)
      .maybeSingle();
    partnerSlug = partner?.slug ?? null;
  }

  return NextResponse.json({ banner: { ...banner, partnerSlug } });
}
