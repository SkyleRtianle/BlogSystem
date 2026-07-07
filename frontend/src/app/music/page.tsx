"use client";

import { useCallback } from "react";
import ImmersiveMusicPage from "@/components/ImmersiveMusicPage";
import SiteHeader from "@/components/SiteHeader";
import {
  clearAuthSession,
  redirectToLogin,
  useAuthUser,
} from "@/lib/auth";
import { useAppSettings } from "@/lib/useAppSettings";

export default function MusicPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const currentUser = useAuthUser();

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  return (
    <main
      className="music-immersive-shell"
      style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}
    >
      <ImmersiveMusicPage
        header={(
          <SiteHeader
            active="音乐"
            isNight={isNight}
            showWallpaper={showWallpaper}
            user={currentUser}
            glassAlpha={glassAlpha}
            onGlassAlphaChange={setGlassAlpha}
            onToggleNight={toggleNight}
            onToggleWallpaper={toggleWallpaper}
            onLogout={logout}
          />
        )}
      />
    </main>
  );
}
