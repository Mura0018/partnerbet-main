import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "donations.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data: donations } = await admin
    .from("donations")
    .select("id, amount, currency, status, donor_name, is_anonymous, message, external_transaction_id, created_at, payment_methods(name)")
    .order("created_at", { ascending: false })
    .limit(10000);

  const header = ["Date", "Amount", "Currency", "Status", "Donor", "Anonymous", "Message", "Payment Method", "Transaction ID"];
  const rows = (donations ?? []).map((d: any) => [
    d.created_at, d.amount, d.currency, d.status,
    d.is_anonymous ? "" : d.donor_name ?? "",
    d.is_anonymous ? "Yes" : "No",
    d.message ?? "",
    d.payment_methods?.name ?? "",
    d.external_transaction_id ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
