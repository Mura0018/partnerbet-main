import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Maps admin sub-routes to the specific permission they require. Anything
// under /admin not listed here only needs is_admin_user() (any staff role).
const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/admin/blog", permission: "posts.manage" },
  { prefix: "/admin/football-news", permission: "football_news.manage" },
  { prefix: "/admin/categories", permission: "taxonomy.manage" },
  { prefix: "/admin/tags", permission: "taxonomy.manage" },
  { prefix: "/admin/media", permission: "media.manage" },
  { prefix: "/admin/faq", permission: "faqs.manage" },
  { prefix: "/admin/streaming", permission: "streaming.manage" },
  { prefix: "/admin/donations", permission: "donations.manage" },
  { prefix: "/admin/push", permission: "settings.manage" },
  { prefix: "/admin/insights", permission: "match_insights.manage" },
  { prefix: "/admin/apk", permission: "apk.manage" },
  { prefix: "/admin/banners", permission: "advertisements.manage" },
  { prefix: "/admin/affiliates", permission: "promotions.manage" },
  { prefix: "/admin/football", permission: "football.manage" },
  { prefix: "/admin/users", permission: "users.manage" },
  { prefix: "/admin/settings", permission: "settings.manage" },
  { prefix: "/admin/telegram-bot", permission: "telegram_orders.manage" },
  { prefix: "/admin/partners", permission: "partners.manage" },
];

function buildSupabaseClient(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => response.cookies.set({ name, value, ...options }),
      remove: (name: string, options: any) => response.cookies.set({ name, value: "", ...options }),
    },
  });
}

async function handleAdminRoute(request: NextRequest) {
  const response = NextResponse.next();
  const loginRedirect = () => {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  };

  const supabase = buildSupabaseClient(request, response);
  if (!supabase) return loginRedirect();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return loginRedirect();

  // If this account has 2FA enrolled, the session must actually be at
  // aal2 (password + TOTP both verified) to reach /admin — a stolen or
  // reused aal1 cookie alone isn't enough. This is enforcement, not just
  // a login-page nicety: the login flow sets aal2 itself after a
  // successful code check, so a legitimate user is never blocked here.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    return loginRedirect();
  }

  const { data: isAdmin } = await supabase.rpc("is_admin_user");
  if (!isAdmin) {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("error", "not_admin");
    return NextResponse.redirect(url);
  }

  // Exact path-segment match (not a raw substring prefix) — e.g. a request
  // to "/admin/football-news" must never match the "/admin/football" rule.
  // This used to work only by accident of array ordering; matching on a
  // real segment boundary makes it correct regardless of order.
  const matchedRoute = ROUTE_PERMISSIONS.find(
    (r) => request.nextUrl.pathname === r.prefix || request.nextUrl.pathname.startsWith(`${r.prefix}/`)
  );
  if (matchedRoute) {
    const { data: hasPermission } = await supabase.rpc("has_permission", { perm_key: matchedRoute.permission });
    if (!hasPermission) {
      const url = new URL("/admin/dashboard", request.url);
      url.searchParams.set("error", "forbidden");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

async function handlePublicRoute(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = buildSupabaseClient(request, response);
  if (!supabase) return response; // fail open on public pages if env misconfigured

  // site_settings is publicly readable (Phase 1 RLS) — no auth needed here.
  const { data: maintenanceRow } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "maintenance")
    .maybeSingle();

  const maintenanceEnabled = !!(maintenanceRow?.value as any)?.enabled;
  if (!maintenanceEnabled) return response;

  // Admins/staff can still browse the live site during maintenance.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    const { data: isAdmin } = await supabase.rpc("is_admin_user");
    if (isAdmin) return response;
  }

  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return handleAdminRoute(request);
  }
  return handlePublicRoute(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icon|sw.js|admin|auth|api|go|maintenance).*)",
  ],
};
