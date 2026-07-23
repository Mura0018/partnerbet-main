import crypto from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";

const APP_ORIGIN = "https://www.couponbet.org";

// Hamkor a'zosi uchun parol o'rnatish taklifi (invite) yaratadi va havola qaytaradi.
export async function createPartnerInvite(profileId: string): Promise<string> {
  const admin = createAdminClient();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 soat

  // Eski ishlatilmagan takliflarni tozalab, yangisini qo'yamiz.
  await admin.from("partner_invites").delete().eq("profile_id", profileId).is("used_at", null);
  await admin.from("partner_invites").insert({ profile_id: profileId, token, expires_at: expiresAt });

  return `${APP_ORIGIN}/partner/set-password?token=${token}`;
}
