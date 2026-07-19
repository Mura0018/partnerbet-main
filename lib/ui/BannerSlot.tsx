"use client";

import React, { useEffect, useState } from "react";

type BannerData = {
  id: string;
  kind: "image" | "embed";
  image_url: string | null;
  embed_code: string | null;
  target_url: string | null;
  partnerSlug: string | null;
};

export function BannerSlot({ placement, size, className = "" }: { placement: string; size?: string; className?: string }) {
  const [banner, setBanner] = useState<BannerData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ placement, ...(size ? { size } : {}) });
    fetch(`/api/banners/active?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setBanner(data.banner ?? null);
        if (data.banner) {
          fetch("/api/banners/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.banner.id, action: "view" }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setBanner(null);
      });
    return () => {
      cancelled = true;
    };
  }, [placement, size]);

  if (!banner) return null;

  const handleClick = () => {
    fetch("/api/banners/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: banner.id, action: "click" }),
      keepalive: true,
    }).catch(() => {});
  };

  const href = banner.partnerSlug ? `/go/${banner.partnerSlug}?banner=${banner.id}` : banner.target_url || "#";

  if (banner.kind === "embed" && banner.embed_code) {
    return (
      <a href={href} onClick={handleClick} target="_blank" rel="noopener noreferrer nofollow sponsored" className={className}>
        <div dangerouslySetInnerHTML={{ __html: banner.embed_code }} />
      </a>
    );
  }

  if (!banner.image_url) return null;

  return (
    <a
      href={href}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`block rounded-2xl overflow-hidden border border-white/10 shadow-2xl ${className}`}
    >
      <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
    </a>
  );
}
