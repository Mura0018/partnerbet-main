"use client";
import { useEffect, useRef } from "react";

export function useHistoryNav(currentKey: string, isRoot: boolean, onBack: () => void) {
  const prevKey = useRef<string | null>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (prevKey.current === null) {
      window.history.replaceState({ navKey: currentKey }, "");
    } else if (prevKey.current !== currentKey && !isRoot) {
      window.history.pushState({ navKey: currentKey }, "");
    }
    prevKey.current = currentKey;
  }, [currentKey, isRoot]);

  useEffect(() => {
    const handler = () => { onBackRef.current(); };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
}
