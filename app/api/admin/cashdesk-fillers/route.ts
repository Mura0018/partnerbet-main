import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { fillRoleIds } from "@/lib/cashdesk/fillers";

// =========================================================
// 6b — Kassa <-> to'ldiruvchi biriktirish (faqat cashdesks.manage).
//  GET    -> nomzodlar ('cashdesks.fill' rolidagi aktiv xodimlar) + barcha biriktirishlar
//  POST   {cashdeskId, userId} -> biriktirish
//  DELETE {cashdeskId, userId} -> olib tashlash
// telegram_chat_id hech qachon qaytmaydi — faqat hasTelegram (boolean).
// =========================================================

async function guard() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "cashdesks.manage" });
  if (!allowed) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { error: null };
}

type CandidateRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  telegram_chat_id: number | null;
  notify_cashdesk_low?: boolean | null;
  roles: { key: string } | null;
};

async function loadCandidates(admin: SupabaseClient): Promise<CandidateRow[]> {
  const roleIds = await fillRoleIds(admin);
  if (roleIds.length === 0) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, display_name, email, telegram_chat_id, notify_cashdesk_low, roles(key)")
    .in("role_id", roleIds)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  // super_admin ham cashdesks.fill'ga ega, lekin u har doim BARCHA xabarlarni
  // oladi (notifyLowBalance 1-auditoriya) — biriktirish unga ta'sir qilmaydi,
  // shuning uchun nomzodlar ro'yxatida ko'rsatilmaydi (POST ham rad etadi).
  return ((data ?? []) as unknown as CandidateRow[]).filter((c) => c.roles?.key !== "super_admin");
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;
  const admin = createAdminClient();
  try {
    const candidates = await loadCandidates(admin);
    const { data: rows, error } = await admin.from("cashdesk_fillers").select("cashdesk_id, user_id");
    if (error) throw error;
    return NextResponse.json({
      candidates: candidates.map((c) => ({
        id: c.id,
        name: c.display_name || c.full_name || c.email || "—",
        roleKey: c.roles?.key ?? null,
        hasTelegram: c.telegram_chat_id != null,
        notifyOn: c.notify_cashdesk_low !== false,
      })),
      assignments: rows ?? [],
    });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

async function parseBody(req: NextRequest): Promise<{ cashdeskId: string; userId: string } | null> {
  const body = await req.json().catch(() => null);
  const cashdeskId = typeof body?.cashdeskId === "string" ? body.cashdeskId : "";
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!cashdeskId || !userId) return null;
  return { cashdeskId, userId };
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  try {
    // Faqat 'cashdesks.fill' rolidagi aktiv xodimni biriktirish mumkin.
    const candidates = await loadCandidates(admin);
    if (!candidates.some((c) => c.id === body.userId)) {
      return NextResponse.json({ error: "not_a_filler" }, { status: 400 });
    }
    const { data: desk } = await admin.from("cashdesks").select("id").eq("id", body.cashdeskId).maybeSingle();
    if (!desk) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const { error } = await admin
      .from("cashdesk_fillers")
      .upsert({ cashdesk_id: body.cashdeskId, user_id: body.userId }, { onConflict: "cashdesk_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await parseBody(req);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("cashdesk_fillers")
    .delete()
    .eq("cashdesk_id", body.cashdeskId)
    .eq("user_id", body.userId);
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
