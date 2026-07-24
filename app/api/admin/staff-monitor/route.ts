import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Xodimlar nazorati — har operator statistikasi + kirish (login) + shubhali
// belgilar. Faqat operators.oversight (super_admin).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "operators.oversight" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // 1) Bazaviy statistika (RPC)
  const { data: base } = await admin.rpc("staff_monitor");
  const rows: any[] = (base as any[]) ?? [];

  // 2) Email + oxirgi kirish (auth.users)
  const emailById = new Map<string, string>();
  const lastLoginById = new Map<string, string | null>();
  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of (list?.users ?? []) as any[]) {
      if (u.email) emailById.set(u.id, String(u.email).toLowerCase());
      lastLoginById.set(u.id, u.last_sign_in_at ?? null);
    }
  } catch {
    /* auth ro'yxati olinмаса — kirish ma'lumotsiz davom */
  }

  // 3) Muvaffaqiyatsiz kirishlar (oxirgi 7 kun)
  const failedByEmail = new Map<string, number>();
  try {
    const emails = Array.from(emailById.values());
    if (emails.length) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: att } = await admin
        .from("login_attempts")
        .select("identifier")
        .eq("success", false)
        .gte("created_at", since)
        .in("identifier", emails);
      for (const a of (att ?? []) as any[]) failedByEmail.set(a.identifier, (failedByEmail.get(a.identifier) ?? 0) + 1);
    }
  } catch {
    /* login_attempts yo'q -> e'tiborsiz */
  }

  const out = rows.map((r) => {
    const email = emailById.get(r.id) ?? null;
    const failed = email ? failedByEmail.get(email) ?? 0 : 0;
    const total = Number(r.completed) + Number(r.rejected);
    const rejectRatio = total >= 3 ? Number(r.rejected) / total : 0;

    const flags: string[] = [];
    if (Number(r.rating) < 0) flags.push("low_rating");
    if (rejectRatio > 0.4) flags.push("many_rejects");
    if (failed >= 5) flags.push("many_failed");
    if (Number(r.open_debt) > 0) flags.push("open_debt");

    return {
      ...r,
      email,
      last_login: lastLoginById.get(r.id) ?? null,
      failed_logins: failed,
      flags,
    };
  });

  return NextResponse.json({ operators: out });
}
