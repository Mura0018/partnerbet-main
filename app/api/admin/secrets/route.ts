import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getApiCredentialStatuses, setApiCredential } from "@/lib/auth/apiCredentials";

const MANAGED_KEYS = [
  "football_api_key", "sportmonks_api_key", "footballdata_org_api_key",
  "push_fcm_server_key", "push_vapid_public_key", "push_vapid_private_key",
];

async function requireSettingsManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "settings.manage" });
  if (!allowed) return { ok: false as const, status: 403 };

  return { ok: true as const, userId: user.id };
}

export async function GET() {
  const check = await requireSettingsManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const statuses = await getApiCredentialStatuses(MANAGED_KEYS);
  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest) {
  const check = await requireSettingsManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  let body: { key?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.key || !MANAGED_KEYS.includes(body.key) || !body.value) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setApiCredential(body.key, body.value, check.userId);
  return NextResponse.json({ success: true });
}
