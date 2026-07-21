import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { reassignStaleThread } from "@/lib/support/staleReassign";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // check-stale-claims bilan bir xil himoya: ?secret= query param.
  const expected = process.env.CRON_CHECK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  // Faol (arxivlanmagan, tugamagan), operatorga biriktirilgan threadlar
  const { data: threads } = await supabase
    .from("telegram_support_threads")
    .select("customer_id")
    .eq("is_archived", false)
    .not("claimed_by", "is", null);

  let reassigned = 0;
  for (const t of threads ?? []) {
    const done = await reassignStaleThread(t.customer_id);
    if (done) reassigned++;
  }

  return NextResponse.json({ ok: true, checked: threads?.length ?? 0, reassigned });
}
