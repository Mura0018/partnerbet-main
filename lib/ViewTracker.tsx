"use client";

import { useEffect, useRef } from "react";

// Fire-and-forget view counter — mounted once on an article's detail
// page. Client-side (rather than counted during server render) so
// prefetches/crawlers hitting the server component don't inflate counts
// as much as a real reader's browser visit does.
export function ViewTracker({ table, id }: { table: "posts" | "football_news"; id: string }) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch("/api/content/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, id }),
    }).catch(() => {});
  }, [table, id]);
  return null;
}
