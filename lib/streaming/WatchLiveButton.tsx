"use client";

import React, { useEffect, useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import { StreamPlayerModal } from "@/lib/streaming/StreamPlayerModal";

type StreamProviderOption = { matchStreamId: string; providerId: string; providerName: string; isPrimary: boolean };

// Renders nothing automatically when no official stream is configured for
// this match — no empty button, no placeholder, per spec.
export function WatchLiveButton({ footballProvider, externalFixtureId }: { footballProvider: string; externalFixtureId: string }) {
  const [providers, setProviders] = useState<StreamProviderOption[]>([]);
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<StreamProviderOption | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/streaming/match-availability?footballProvider=${footballProvider}&fixtureId=${externalFixtureId}`);
        const json = await res.json();
        setProviders(json.providers ?? []);
      } catch {
        setProviders([]);
      } finally {
        setChecked(true);
      }
    })();
  }, [footballProvider, externalFixtureId]);

  if (!checked || providers.length === 0) return null;

  const primary = providers.find((p) => p.isPrimary) ?? providers[0];

  const openPlayer = (option: StreamProviderOption) => {
    setSelected(option);
    setShowSelector(false);
  };

  return (
    <>
      <div className="relative inline-flex">
        <button
          onClick={() => (providers.length > 1 ? setShowSelector((v) => !v) : openPlayer(primary))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cta to-cta-dim text-white font-semibold text-[12px] hover:brightness-110 transition active:scale-[0.98]"
        >
          <Play size={13} fill="currentColor" /> Watch Live
          {providers.length > 1 && <ChevronDown size={13} />}
        </button>

        {showSelector && providers.length > 1 && (
          <div className="absolute top-full mt-1.5 right-0 z-20 rounded-lg border border-white/10 bg-bg-panel shadow-xl overflow-hidden min-w-[160px]">
            {providers.map((p) => (
              <button
                key={p.matchStreamId}
                onClick={() => openPlayer(p)}
                className="w-full text-left px-3.5 py-2.5 text-[12px] hover:bg-white/5 transition flex items-center justify-between"
              >
                {p.providerName}
                {p.isPrimary && <span className="text-[10px] text-vip">★</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <StreamPlayerModal matchStreamId={selected.matchStreamId} providerName={selected.providerName} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
