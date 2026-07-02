"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_GLASS_ALPHA = 0.6;

function load(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`home_${key}`);
}

function loadGlassAlpha() {
  const alpha = load("glassAlpha");
  if (!alpha) return DEFAULT_GLASS_ALPHA;
  const parsedAlpha = parseFloat(alpha);
  return Number.isFinite(parsedAlpha) ? parsedAlpha : DEFAULT_GLASS_ALPHA;
}

export function useAppSettings() {
  const [isNight, setIsNight] = useState(() => load("isNight") === "true");
  const [showWallpaper, setShowWallpaper] = useState(() => load("showWallpaper") !== "false");
  const [glassAlpha, setGlassAlpha] = useState(loadGlassAlpha);

  useEffect(() => { localStorage.setItem("home_isNight", String(isNight)); }, [isNight]);
  useEffect(() => { localStorage.setItem("home_showWallpaper", String(showWallpaper)); }, [showWallpaper]);
  useEffect(() => { localStorage.setItem("home_glassAlpha", String(glassAlpha)); }, [glassAlpha]);

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
