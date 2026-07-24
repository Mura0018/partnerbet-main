import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// B7 (A): mijozlar faollik reytingi (bajarilgan buyurtmalar summasi bo'yicha)
// + kim karta olgan. Faqat promo.manage (super_admin). Server agregatsiya (RPC).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "promo.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: ranking } = await admin.rpc("promo_activity_ranking", { p_limit: 200 });
  return NextResponse.json({ ranking: ranking ?? [] });
}
