import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// A user's own login history — no special permission needed beyond being
// authenticated, since login_attempts has no RLS policies at all (only
// service-role can read it) and this only ever returns rows matching the
// caller's own email.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("login_attempts")
    .select("ip_address, user_agent, success, created_at")
    .eq("identifier", user.email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ history: data ?? [] });
}
