import type { createClient } from "@/lib/supabase";

// 6c — Login'dan keyingi admin "uy" sahifasi. Faqat cashdesk_filler roli
// /admin/cashdesk-balance ga tushadi; qolgan barcha rollar (va har qanday
// xato holati) avvalgidek /admin/dashboard.
export const DEFAULT_ADMIN_HOME = "/admin/dashboard";
const ROLE_HOME: Record<string, string> = {
  cashdesk_filler: "/admin/cashdesk-balance",
};

export async function resolveAdminHome(supabase: ReturnType<typeof createClient>): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_ADMIN_HOME;
    const { data } = await supabase.from("profiles").select("roles(key)").eq("id", user.id).maybeSingle();
    const key = (data as { roles?: { key?: string } | null } | null)?.roles?.key;
    return (key && ROLE_HOME[key]) || DEFAULT_ADMIN_HOME;
  } catch {
    return DEFAULT_ADMIN_HOME;
  }
}
