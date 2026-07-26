import { createAdminClient } from "@/lib/supabaseAdmin";
import { matchCustomerName } from "@/lib/customers/nameMatch";

export type NameCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "full_name_required" }
  | { allowed: false; reason: "name_mismatch" };

// W1.4 — buyurtma yaratishdan OLDIN chaqiriladi (playerName cashdesk'dan
// olingandan keyin). Operator override qo'yilgan mijoz uchun tekshiruv
// butunlay o'tkazib yuboriladi (bir marta tasdiqlangach qayta-qayta
// bloklanmasin).
export async function checkCustomerNameMatch(
  customerId: string,
  fullName: string | null,
  playerName: string | null,
  platform: string,
  accountId: string
): Promise<NameCheckResult> {
  const admin = createAdminClient();

  const { data: cust } = await admin
    .from("customers")
    .select("name_override_by")
    .eq("id", customerId)
    .maybeSingle();
  if ((cust as any)?.name_override_by) return { allowed: true };

  const result = matchCustomerName(fullName, playerName);

  if (result === "no_reference") {
    // full_name bo'sh -> mijozdan bir marta so'raladi (eski mijozlar
    // bloklanmasin — playerName bo'sh bo'lsa solishtirish umuman
    // mumkin emas, bu holatda ham tekshiruv o'tkazib yuboriladi).
    if (!fullName || !fullName.trim()) return { allowed: false, reason: "full_name_required" };
    return { allowed: true };
  }

  if (result === "mismatched") {
    try {
      await admin.from("name_mismatch_flags").insert({
        customer_id: customerId,
        registered_name: fullName ?? "",
        player_name: playerName ?? "",
        platform,
        account_id: accountId,
      });
    } catch {
      /* audit best-effort — bloklash baribir amal qiladi */
    }
    return { allowed: false, reason: "name_mismatch" };
  }

  return { allowed: true };
}
