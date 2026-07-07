"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_GLASS_ALPHA = 0.6;
const DEFAULT_WALLPAPER_URL = "/images/home-background.png";
let cachedIsNight = false;
let cachedShowWallpaper = true;
let cachedGlassAlpha = DEFAULT_GLASS_ALPHA;
let cachedWallpaperUrl = DEFAULT_WALLPAPER_URL;

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

function cssUrl(url: string) {
  return `url("${url.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function syncWallpaperVariable(url: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--home-wallpaper-image", cssUrl(url));
}

function persistWallpaperUrl(url: string) {
  if (typeof window === "undefined") return;
  if (url === DEFAULT_WALLPAPER_URL) {
    localStorage.removeItem("home_wallpaperUrl");
    return;
  }
  localStorage.setItem("home_wallpaperUrl", url);
}

export function useAppSettings() {
  const [isNight, setIsNight] = useState(cachedIsNight);
  const [showWallpaper, setShowWallpaper] = useState(cachedShowWallpaper);
  const [glassAlpha, setGlassAlphaState] = useState(cachedGlassAlpha);
  const [wallpaperUrl, setWallpaperUrlState] = useState(cachedWallpaperUrl);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cachedIsNight = load("isNight") === "true";
      cachedShowWallpaper = load("showWallpaper") !== "false";
      cachedGlassAlpha = loadGlassAlpha();
      cachedWallpaperUrl = load("wallpaperUrl") || DEFAULT_WALLPAPER_URL;
      setIsNight(cachedIsNight);
      setShowWallpaper(cachedShowWallpaper);
      setGlassAlphaState(cachedGlassAlpha);
      setWallpaperUrlState(cachedWallpaperUrl);
      syncWallpaperVariable(cachedWallpaperUrl);
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
  useEffect(() => {
    cachedWallpaperUrl = wallpaperUrl;
    syncWallpaperVariable(wallpaperUrl);
    if (!hydrated) return;
    try {
      persistWallpaperUrl(wallpaperUrl);
    } catch {
      // The setter persists first so upload errors can be surfaced there.
    }
  }, [wallpaperUrl, hydrated]);

  const setGlassAlpha = useCallback((value: number) => {
    cachedGlassAlpha = value;
    setGlassAlphaState(value);
  }, []);

  const setWallpaperUrl = useCallback((value: string) => {
    persistWallpaperUrl(value);
    cachedWallpaperUrl = value;
    cachedShowWallpaper = true;
    cachedIsNight = false;
    setWallpaperUrlState(value);
    setShowWallpaper(true);
    setIsNight(false);
  }, []);

  const resetWallpaper = useCallback(() => {
    setWallpaperUrl(DEFAULT_WALLPAPER_URL);
  }, [setWallpaperUrl]);

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

  return {
    isNight,
    showWallpaper,
    glassAlpha,
    wallpaperUrl,
    setGlassAlpha,
    setWallpaperUrl,
    resetWallpaper,
    toggleNight,
    toggleWallpaper,
  };
}
