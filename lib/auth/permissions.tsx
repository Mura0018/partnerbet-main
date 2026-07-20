"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  locale: "uz" | "ru" | "en";
  role_id: string;
  roles: { key: string; name: string } | null;
};

// Fetches the current user's profile + role once per mount. Used to render
// the correct nav items / role badge in the admin chrome.
export function useCurrentProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url, is_active, locale, role_id, roles(key, name)")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        setProfile((data as any) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading };
}

// Checks a single permission key against the current session via the
// has_permission() RPC (same function RLS uses server-side) — this is a
// frontend convenience/UX layer only; the authoritative enforcement is
// always the Postgres RLS policy itself, which cannot be bypassed even if
// this check is skipped or tampered with client-side.
export function usePermission(permissionKey: string) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("has_permission", { perm_key: permissionKey });
      if (!cancelled) setAllowed(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [permissionKey]);

  return allowed; // null = still checking, true/false = resolved
}

// Declarative permission gate for hiding/disabling UI the current role
// cannot use. Renders nothing while checking (avoids a flash of
// unauthorized content) and nothing if denied.
export function Can({ permission, children }: { permission: string; children: React.ReactNode }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;
  return <>{children}</>;
}
