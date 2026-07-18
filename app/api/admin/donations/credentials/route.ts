import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { setPaymentMethodCredential, getPaymentMethodCredentialStatuses } from "@/lib/donations/credentials";

async function requireDonationsManage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "donations.manage" });
  if (!allowed) return { ok: false as const, status: 403 };
  return { ok: true as const, userId: user.id };
}

const FIELDS_BY_PROVIDER: Record<string, string[]> = {
  stripe: ["secret_key", "webhook_secret"],
  paypal: ["client_id", "client_secret", "webhook_id"],
  generic: ["api_key", "api_secret"],
};

export async function GET(req: NextRequest) {
  const check = await requireDonationsManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  const paymentMethodId = req.nextUrl.searchParams.get("paymentMethodId");
  const providerKey = req.nextUrl.searchParams.get("providerKey");
  if (!paymentMethodId || !providerKey || !FIELDS_BY_PROVIDER[providerKey]) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const statuses = await getPaymentMethodCredentialStatuses(paymentMethodId, FIELDS_BY_PROVIDER[providerKey]);
  return NextResponse.json({ statuses });
}

export async function POST(req: NextRequest) {
  const check = await requireDonationsManage();
  if (!check.ok) return NextResponse.json({ error: "forbidden" }, { status: check.status });

  let body: { paymentMethodId?: string; field?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.paymentMethodId || !body.field || !body.value) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await setPaymentMethodCredential(body.paymentMethodId, body.field, body.value, check.userId);
  return NextResponse.json({ success: true });
}
