import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Non-secret by design — card/Click/Payme numbers and the crypto wallet
// address must be shown to the customer to complete a top-up, same as
// site_settings' public-read policy already allows for every other key.
export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", "betcore_pay_payment_info").maybeSingle();
  const info = (data?.value as any) ?? {};
  return NextResponse.json(
    {
      cardNumber: info.card_number ?? "",
      clickNumber: info.click_number ?? "",
      paymeNumber: info.payme_number ?? "",
      cryptoWallet: info.crypto_wallet ?? "",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
