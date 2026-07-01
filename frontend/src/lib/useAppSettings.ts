"use client";

import { useCallback, useEffect, useState } from "react";

function load(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`home_${key}`);
}

export function useAppSettings() {
  const [isNight, setIsNight] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(true);
  const [glassAlpha, setGlassAlpha] = useState(0.72);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsNight(load("isNight") === "true");
    setShowWallpaper(load("showWallpaper") !== "false");
    const alpha = load("glassAlpha");
    if (alpha) setGlassAlpha(parseFloat(alpha));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem("home_isNight", String(isNight)); }, [isNight, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("home_showWallpaper", String(showWallpaper)); }, [showWallpaper, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("home_glassAlpha", String(glassAlpha)); }, [glassAlpha, hydrated]);

  const toggleNight = useCallback(() => {
    setIsNight((v) => {
      if (!v) setShowWallpaper(true);
      return !v;
    });
  }, []);
  const toggleWallpaper = useCallback(() => {
    setShowWallpaper((v) => {
      if (v) setIsNight(false);
      return !v;
    });
  }, []);

  return { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper };
}
