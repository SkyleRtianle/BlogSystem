"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import {
  useAudioActions,
  useAudioState,
  type SongInfo,
} from "@/lib/audioState";
import { useAppSettings } from "@/lib/useAppSettings";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const state = useAudioState();
  const actions = useAudioActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "playlist">("search");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const artistName = useMemo(
    () => state.currentSong?.artists.map((a) => a.name).join(" / ") ?? "",
    [state.currentSong],
  );

  const albumPic = useMemo(
    () => state.currentSong?.album.picUrl ?? "",
    [state.currentSong],
  );

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const doSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    setSearchError("");
    try {
      const songs = await actions.searchSongs(keyword);
      setSearchResults(songs);
      if (songs.length === 0) setSearchError("未找到相关歌曲");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setIsSearching(false);
    }
  }, [actions]);

  const onSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 350);
  }, [doSearch]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelector(".page-fade-in")?.classList.add("page-fade-in-ready");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    actions.seekTo(((e.clientX - rect.left) / rect.width) * (state.duration || 0));
  }, [actions, state.duration]);

  const shellClass = useMemo(() => {
    const base = "home-shell min-h-screen";
    if (isNight) return `${base} home-night bg-black text-slate-100`;
    if (!showWallpaper) return `${base} bg-white text-slate-900`;
    return `${base} text-slate-900`;
  }, [isNight, showWallpaper]);

  const loopLabels: Record<string, string> = { list: "🔁", single: "🔂", random: "🔀" };

  return (
    <main
      className={shellClass}
      style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}
    >
      {showWallpaper && !isNight && (
        <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />
      )}

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

      <section className="music-page-layout page-fade-in mx-auto max-w-[1300px] px-4 py-8 sm:px-8">
        <div className="music-player-main">
          <div className="music-player-art">
            <span
              style={albumPic ? { backgroundImage: `url("${albumPic}")` } : undefined}
            />
          </div>
          <div className="music-player-info">
            <h2>{state.currentSong?.name ?? "未选择歌曲"}</h2>
            <p>{artistName || "搜索歌曲开始播放"}</p>
          </div>

          <div className="music-player-bar" onClick={seek}>
            <div className="music-player-bar-track">
              <div className="music-player-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="music-player-bar-times">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>

          <div className="music-page-controls">
            <button onClick={() => actions.setLoopMode(
              state.loopMode === "list" ? "single" : state.loopMode === "single" ? "random" : "list"
            )} title={state.loopMode}>
              {loopLabels[state.loopMode]}
            </button>
            <button onClick={actions.playPrev} disabled={state.playlist.length === 0}>‹‹</button>
            <button className="music-page-play" onClick={actions.togglePlay}>
              {state.isPlaying ? "❚❚" : "▶"}
            </button>
            <button onClick={actions.playNext} disabled={state.playlist.length === 0}>››</button>
            <div className="music-page-volume">
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(state.volume * 100)}
                onChange={(e) => actions.setVolume(parseInt(e.target.value, 10) / 100)}
              />
            </div>
          </div>

          <div className="music-page-lyrics">
            {state.lyrics && state.lyrics.length > 0 ? (
              state.lyrics.map((line, i) => (
                <p key={i} className={i === state.lyricIndex ? "music-lyric-active" : "music-lyric-dimmed"}>
                  {line.text}
                </p>
              ))
            ) : (
              <p className="music-lyric-dimmed">暂无歌词</p>
            )}
          </div>
        </div>

        <div className="music-page-sidebar">
          <div className="music-page-tabs">
            <button
              className={activeTab === "search" ? "music-tab-active" : ""}
              onClick={() => setActiveTab("search")}
            >
              搜索添加
            </button>
            <button
              className={activeTab === "playlist" ? "music-tab-active" : ""}
              onClick={() => setActiveTab("playlist")}
            >
              播放列表 ({state.playlist.length})
            </button>
          </div>

          {activeTab === "search" && (
            <div className="music-search-area">
              <input
                className="music-player-search-input"
                value={searchQuery}
                onChange={(e) => onSearchInput(e.target.value)}
                placeholder="搜索歌曲..."
              />
              <div className="music-player-results">
                {isSearching && <div className="music-player-results-status">搜索中...</div>}
                {!isSearching && searchError && (
                  <div className="music-player-results-status">{searchError}</div>
                )}
                {!isSearching && searchResults.map((s) => (
                  <div key={s.id} className="music-player-result-item">
                    <span
                      className="music-player-result-pic"
                      style={s.album.picUrl ? { backgroundImage: `url("${s.album.picUrl}")` } : undefined}
                    />
                    <span className="music-player-result-text">
                      <strong>{s.name}</strong>
                      <small>{s.artists.map((a) => a.name).join(" / ")}</small>
                    </span>
                    <button
                      className="music-add-btn"
                      onClick={() => { actions.addToPlaylist(s); actions.playSong(s); }}
                    >
                      播放
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "playlist" && (
            <div className="music-playlist-area">
              {state.playlist.length === 0 ? (
                <div className="music-player-results-status">播放列表为空，搜索添加歌曲</div>
              ) : (
                state.playlist.map((song, i) => (
                  <div
                    key={`${song.id}-${i}`}
                    className={`music-player-result-item ${i === state.playlistIndex ? "music-player-result-active" : ""}`}
                    onClick={() => actions.playAtIndex(i)}
                  >
                    <span className="music-playlist-index">{i + 1}</span>
                    <span
                      className="music-player-result-pic"
                      style={song.album.picUrl ? { backgroundImage: `url("${song.album.picUrl}")` } : undefined}
                    />
                    <span className="music-player-result-text">
                      <strong>{song.name}</strong>
                      <small>{song.artists.map((a) => a.name).join(" / ")}</small>
                    </span>
                    <button
                      className="music-remove-btn"
                      onClick={(e) => { e.stopPropagation(); actions.removeFromPlaylist(i); }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
              {state.playlist.length > 0 && (
                <button className="music-clear-btn" onClick={actions.clearPlaylist}>清空列表</button>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
