import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Mijoz app uchun AKTIV reklama bannerlari (ochiq kontent). Service role
// orqali — faqat aktivlar, tartiб bilan.
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("promo_banners")
    .select("id, title, subtitle, image_url, link_url")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ banners: data ?? [] });
}
