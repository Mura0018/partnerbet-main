import { NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";

// The VAPID PUBLIC key is, by design, not secret — the browser's Push API
// requires it client-side to create a subscription. Only this one key is
// ever exposed; the private key and every other api_credentials entry
// remain completely inaccessible to the browser.
export async function GET() {
  const publicKey = await getApiCredential("push_vapid_public_key");
  return NextResponse.json({ publicKey: publicKey ?? null });
}
