import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { encryptSecret } from "@/lib/security/encryption";
import { getLegacyCreds, CASHDESK_PUBLIC_COLS } from "@/lib/cashdesk/store";

// Bir martalik ko'chirish: eski api_credentials dagi BITTA kassa (4 kalit)
// yangi cashdesks jadvaliga qayta shifrlab yoziladi. Idempotent — o'sha
// cashdesk_id allaqachon bo'lsa qayta yozmaydi. SQL emas, server (bu yerda)
// shifrlaydi, chunki ENCRYPTION_KEY faqat serverda.
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const creds = await getLegacyCreds();
  if (!creds) return NextResponse.json({ ok: false, error: "no_legacy" });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("cashdesks")
    .select("id")
    .eq("cashdesk_id", creds.cashdeskId)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyExists: true });

  const { data, error } = await admin
    .from("cashdesks")
    .insert({
      name: "Asosiy kassa",
      cashdesk_id: creds.cashdeskId,
      login: creds.login,
      pass_enc: encryptSecret(creds.pass),
      hash_enc: encryptSecret(creds.hash),
      is_active: true,
      note: "api_credentials dan avtomatik ko'chirilgan",
    })
    .select(CASHDESK_PUBLIC_COLS)
    .maybeSingle();

  if (error) {
    if ((error as any).code === "23505") return NextResponse.json({ ok: true, alreadyExists: true });
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, imported: true, cashdesk: data });
}
