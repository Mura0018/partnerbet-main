import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

type Attempt = {
  id: string;
  identifier: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
};

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "noma'lum qurilma";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("android")
    ? "Android"
    : ua.includes("iphone") || ua.includes("ipad")
    ? "iPhone/iPad"
    : ua.includes("windows")
    ? "Windows kompyuter"
    : ua.includes("macintosh") || ua.includes("mac os")
    ? "Mac kompyuter"
    : ua.includes("linux")
    ? "Linux kompyuter"
    : "noma'lum qurilma";
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome")
    ? "Chrome"
    : ua.includes("firefox")
    ? "Firefox"
    : ua.includes("safari")
    ? "Safari"
    : "noma'lum brauzer";
  return `${os}, ${browser}`;
}

const FAILED_ATTEMPT_ALERT_THRESHOLD = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { data: allowed } = await supabase.rpc("has_permission", { perm_key: "security.manage" });
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const [{ data: attemptsRaw }, { data: blockedRaw }] = await Promise.all([
    admin.from("login_attempts").select("id, identifier, ip_address, user_agent, success, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    admin.from("blocked_ips").select("ip_address, reason, blocked_at, expires_at").or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  ]);

  const attempts = (attemptsRaw as Attempt[]) ?? [];
  const blockedIps = new Set((blockedRaw ?? []).map((b) => b.ip_address));

  // For "new device" flagging: earliest-seen (identifier, ip) pairs among
  // successful logins, scanned oldest-first so the FIRST time a pair
  // appears is never itself flagged as new — only later different pairs.
  const seenPairs = new Set<string>();
  const successesOldestFirst = [...attempts].filter((a) => a.success).reverse();
  const knownPairAtTime = new Map<string, boolean>(); // attempt.id -> hadPriorHistoryForIdentifier
  for (const a of successesOldestFirst) {
    const pairKey = `${a.identifier}::${a.ip_address ?? ""}`;
    const identifierSeenBefore = [...seenPairs].some((k) => k.startsWith(`${a.identifier}::`));
    knownPairAtTime.set(a.id, identifierSeenBefore && !seenPairs.has(pairKey));
    seenPairs.add(pairKey);
  }

  // Failed-attempt clustering: for each attempt, count failures for the
  // same identifier or IP within a 15-minute window ending at that attempt.
  const events = attempts.map((a) => {
    const t = new Date(a.created_at).getTime();
    const windowStart = t - WINDOW_MS;
    const failuresNearby = attempts.filter(
      (b) =>
        !b.success &&
        new Date(b.created_at).getTime() >= windowStart &&
        new Date(b.created_at).getTime() <= t &&
        (b.identifier === a.identifier || (a.ip_address && b.ip_address === a.ip_address))
    ).length;

    const isBlocked = a.ip_address ? blockedIps.has(a.ip_address) : false;
    const isNewDevice = a.success && knownPairAtTime.get(a.id) === true;

    let risk: "high" | "medium" | "low" = "low";
    let description: string;

    if (isBlocked) {
      risk = "high";
      description = `🚫 Bloklangan IP'dan urinish: ${a.identifier} — kirish rad etildi.`;
    } else if (!a.success && failuresNearby >= FAILED_ATTEMPT_ALERT_THRESHOLD) {
      risk = "high";
      description = `🔴 XAVFLI: "${a.identifier}" uchun 15 daqiqada ${failuresNearby} marta noto'g'ri parol kiritildi — hujum (bruteforce) bo'lishi mumkin.`;
    } else if (!a.success) {
      risk = "low";
      description = `❌ "${a.identifier}" uchun noto'g'ri parol kiritildi.`;
    } else if (isNewDevice) {
      risk = "medium";
      description = `🟡 "${a.identifier}" birinchi marta shu IP/qurilmadan kirdi — tanish emas bo'lsa tekshiring.`;
    } else {
      risk = "low";
      description = `✅ "${a.identifier}" tizimga muvaffaqiyatli kirdi.`;
    }

    return {
      id: a.id,
      createdAt: a.created_at,
      identifier: a.identifier,
      ip: a.ip_address,
      device: describeDevice(a.user_agent),
      success: a.success,
      risk,
      description,
      isBlocked,
    };
  });

  return NextResponse.json({ events, blockedIps: blockedRaw ?? [] });
}
