"use client";

import { useMemo } from "react";
import { useAudioActions, useAudioState } from "@/lib/audioState";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export type { LyricLine, SongInfo } from "@/lib/audioState";

export default function MusicPlayer({ hrefPrefix = "", dataReady = true }: { hrefPrefix?: string; dataReady?: boolean }) {
  const state = useAudioState();
  const actions = useAudioActions();

  const artistName = useMemo(
    () => state.currentSong?.artists.map((a) => a.name).join(" / ") ?? "",
    [state.currentSong],
  );

  const albumPic = useMemo(
    () => state.currentSong?.album.picUrl ?? "",
    [state.currentSong],
  );

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const seek = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    actions.seekTo(((e.clientX - rect.left) / rect.width) * (state.duration || 0));
  };

  return (
    <section
      className={`showcase-music-card home-card cursor-pointer transition-transform hover:scale-[1.02] ${dataReady ? "card-fly-in" : "card-init-hidden"}`}
      role="button"
      tabIndex={0}
      onClick={() => window.location.href = `${hrefPrefix}/music`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = `${hrefPrefix}/music`;
        }
      }}
      aria-label={state.currentSong ? `正在播放 ${state.currentSong.name} - ${artistName}` : "打开音乐播放器"}
    >
      <div
        className="showcase-music-disc"
        style={albumPic ? {
          backgroundImage: `url("${albumPic}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : undefined}
      >
        <span style={albumPic ? { opacity: 0 } : undefined} />
      </div>
      <div className="showcase-music-copy">
        <small>{state.currentSong ? "网易云音乐" : "Cloud Music"}</small>
        <strong>{state.currentSong?.name ?? "雨爱"}</strong>
        <span>{state.currentSong ? artistName : "杨丞琳"}</span>
      </div>
      <div className="showcase-music-progress">
        <span>{formatTime(state.currentTime)}</span>
        <i onClick={seek}><b style={{ width: `${progress}%` }} /></i>
        <span>{state.currentSong ? formatTime(state.duration || (state.currentSong.duration / 1000)) : "04:20"}</span>
      </div>
      <div className="showcase-music-controls">
        <span aria-hidden="true">‹</span>
        <strong
          role="button"
          aria-label={state.isPlaying ? "暂停" : "播放"}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); actions.togglePlay(); }}
          style={{ cursor: "pointer" }}
        >
          {state.isPlaying ? "❚❚" : "▶"}
        </strong>
        <span aria-hidden="true">›</span>
      </div>
    </section>
  );
}
