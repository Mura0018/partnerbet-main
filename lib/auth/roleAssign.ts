import { createAdminClient } from "@/lib/supabaseAdmin";

// Ruxsat-asosli rol tayinlash cheki: chaqiruvchi FAQAT o'zida bor ruxsatlarni
// TO'LIQ qamrab oladigan va o'zidan QAT'IY QUYI (kamroq ruxsatli) rolni bera
// oladi. Ya'ni o'zida yo'q ruxsatli rolni ham, teng yoki yuqori kuchli rolni
// ham bera olmaydi. Bu "o'zingda yo'q narsani bermang" tamoyili.
async function permKeysForRole(admin: ReturnType<typeof createAdminClient>, roleId: string): Promise<Set<string>> {
  const { data: rp } = await admin.from("role_permissions").select("permission_id").eq("role_id", roleId);
  const ids = ((rp ?? []) as any[]).map((r) => r.permission_id).filter(Boolean);
  if (ids.length === 0) return new Set();
  const { data: perms } = await admin.from("permissions").select("key").in("id", ids);
  return new Set(((perms ?? []) as any[]).map((p) => p.key).filter(Boolean));
}

export async function canAssignRole(callerUserId: string, targetRoleId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: caller } = await admin.from("profiles").select("role_id").eq("id", callerUserId).maybeSingle();
  if (!caller?.role_id) return false;

  const callerPerms = await permKeysForRole(admin, caller.role_id as string);
  const targetPerms = await permKeysForRole(admin, targetRoleId);

  // Target'dagi har bir ruxsat chaqiruvchida ham bo'lishi shart.
  for (const p of targetPerms) {
    if (!callerPerms.has(p)) return false; // o'zida yo'q ruxsatni bera olmaydi
  }
  // Teng yoki yuqori kuchli rol berish taqiqlanadi (qat'iy quyi to'plam bo'lsin).
  if (targetPerms.size >= callerPerms.size) return false;

  return true;
}
