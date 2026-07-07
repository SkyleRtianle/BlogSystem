"use client";

import { useParams } from "next/navigation";
import ImmersiveMusicPage from "@/components/ImmersiveMusicPage";
import PublicHeader from "@/components/PublicHeader";
import { useAppSettings } from "@/lib/useAppSettings";

export default function MusicPage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();

  return (
    <main
      className="music-immersive-shell"
      style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}
    >
      <ImmersiveMusicPage
        header={(
          <PublicHeader
            active="音乐"
            username={username}
            isNight={isNight}
            showWallpaper={showWallpaper}
            glassAlpha={glassAlpha}
            onGlassAlphaChange={setGlassAlpha}
            onToggleNight={toggleNight}
            onToggleWallpaper={toggleWallpaper}
          />
        )}
      />
    </main>
  );
}
