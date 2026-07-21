import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOQ";
  const keyRef = process.env.SUPABASE_SERVICE_ROLE_KEY?.split(".")[1];
  let ref = "?";
  try { ref = JSON.parse(Buffer.from(keyRef || "", "base64").toString()).ref; } catch {}
  return NextResponse.json({ url, keyBazaRef: ref });
}
