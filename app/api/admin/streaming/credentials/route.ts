import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { setProviderCredential, getProviderCredentialStatus } from "@/lib/streaming/credentials";

async function requireStreamingManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "streaming.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

export async function GET(req: NextRequest) {
  const check = await requireStreamingManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const providerId = req.nextUrl.searchParams.get("providerId");
  if (!providerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const status = await getProviderCredentialStatus(providerId);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const check = await requireStreamingManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  let body: { providerId?: string; field?: "api_key" | "api_secret"; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.providerId || !body.value || (body.field !== "api_key" && body.field !== "api_secret")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setProviderCredential(body.providerId, body.field, body.value, check.userId);
  return NextResponse.json({ success: true });
}
