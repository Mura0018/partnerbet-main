import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Mijozlarni admin ro'yxatidan yashirish/qaytarish (soft-hide). FAQAT admin
// ko'rinishi — mijoz app oqimiga ta'sir qilmaydi, ma'lumot o'chmaydi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "customers.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { ids, hidden } = (await req.json().catch(() => ({}))) ?? {};
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const cleanIds = ids.filter((x) => typeof x === "string").slice(0, 500);
  if (cleanIds.length === 0) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  // "Jim muvaffaqiyat" bo'lmasin — .select() bilan haqiqatan o'zgarganini tekshiramiz.
  const { data, error } = await admin
    .from("customers")
    .update({ is_hidden: !!hidden })
    .in("id", cleanIds)
    .select("id");

  if (error) return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });

  return NextResponse.json({ updated: (data ?? []).length });
}
