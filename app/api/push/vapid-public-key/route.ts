import { NextResponse } from "next/server";
import { getApiCredential } from "@/lib/auth/apiCredentials";

export async function GET() {
  const publicKey = await getApiCredential("push_vapid_public_key");
  return NextResponse.json(
    { publicKey: publicKey ?? null },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
