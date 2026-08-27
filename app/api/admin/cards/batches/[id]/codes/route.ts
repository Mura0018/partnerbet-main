import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Partiya kodlari — eksport/preview uchun (CSV admin sahifasida yasaladi).
// Faqat cards.manage. Pul harakati yo'q.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cards.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: batch } = await admin.from("card_batches").select("id, label").eq("id", id).maybeSingle();
  if (!batch) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: cards } = await admin
    .from("promo_cards")
    .select("card_code, status")
    .eq("batch_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    batch: { id: (batch as any).id, label: (batch as any).label },
    codes: (cards ?? []).map((c: any) => ({ code: c.card_code, status: c.status })),
  });
}
