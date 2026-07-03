"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_GLASS_ALPHA = 0.6;
let cachedIsNight = false;
let cachedShowWallpaper = true;
let cachedGlassAlpha = DEFAULT_GLASS_ALPHA;

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
  const [isNight, setIsNight] = useState(cachedIsNight);
  const [showWallpaper, setShowWallpaper] = useState(cachedShowWallpaper);
  const [glassAlpha, setGlassAlphaState] = useState(cachedGlassAlpha);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cachedIsNight = load("isNight") === "true";
      cachedShowWallpaper = load("showWallpaper") !== "false";
      cachedGlassAlpha = loadGlassAlpha();
      setIsNight(cachedIsNight);
      setShowWallpaper(cachedShowWallpaper);
      setGlassAlphaState(cachedGlassAlpha);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    cachedIsNight = isNight;
    if (hydrated) localStorage.setItem("home_isNight", String(isNight));
  }, [isNight, hydrated]);
  useEffect(() => {
    cachedShowWallpaper = showWallpaper;
    if (hydrated) localStorage.setItem("home_showWallpaper", String(showWallpaper));
  }, [showWallpaper, hydrated]);
  useEffect(() => {
    cachedGlassAlpha = glassAlpha;
    if (hydrated) localStorage.setItem("home_glassAlpha", String(glassAlpha));
  }, [glassAlpha, hydrated]);

  const setGlassAlpha = useCallback((value: number) => {
    cachedGlassAlpha = value;
    setGlassAlphaState(value);
  }, []);

  const toggleNight = useCallback(() => {
    setIsNight((v) => {
      const next = !v;
      cachedIsNight = next;
      if (!v) {
        cachedShowWallpaper = true;
        setShowWallpaper(true);
      }
      return next;
    });
  }, []);
  const toggleWallpaper = useCallback(() => {
    setShowWallpaper((v) => {
      const next = !v;
      cachedShowWallpaper = next;
      if (v) {
        cachedIsNight = false;
        setIsNight(false);
      }
      return next;
    });
  }, []);

  return { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper };
}
