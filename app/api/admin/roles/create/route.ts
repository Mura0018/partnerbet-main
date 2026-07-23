import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Yangi (maxsus) rol yaratish. Faqat roles.manage. Ruxsatlar keyin toggle bilan
// beriladi. Mavjud tizim rollari (super_admin/admin/...) kalitlari kodda
// ishlatiladi — shu sabab bu yerda faqat YANGI kalit qo'shiladi, o'zgartirilmaydi.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: canManage } = await supabase.rpc("has_permission", { perm_key: "roles.manage" });
  if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let { key, name } = (await req.json().catch(() => ({}))) ?? {};
  key = (key ?? "").toString().trim().toLowerCase();
  name = (name ?? "").toString().trim();
  if (!key || !name) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("roles").select("id").eq("key", key).maybeSingle();
  if (existing) return NextResponse.json({ error: "key_taken" }, { status: 409 });

  const { error } = await admin.from("roles").insert({ key, name });
  if (error) return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
