"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  useAudioActions,
  useAudioState,
  type SongInfo,
} from "@/lib/audioState";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

function animateLyricScroll(
  container: HTMLDivElement,
  targetTop: number,
  animationRef: MutableRefObject<number | null>,
) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    container.scrollTop = targetTop;
    return;
  }

  if (animationRef.current != null) {
    cancelAnimationFrame(animationRef.current);
  }

  const startTop = container.scrollTop;
  const distance = targetTop - startTop;
  const duration = Math.min(920, Math.max(520, Math.abs(distance) * 1.25));
  const startTime = performance.now();

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutQuint(progress);
    container.scrollTop = startTop + distance * eased;

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(step);
      return;
    }

    container.scrollTop = targetTop;
    animationRef.current = null;
  };

  animationRef.current = requestAnimationFrame(step);
}

type MusicIconName = "loop" | "prev" | "play" | "pause" | "next" | "volume" | "add" | "close" | "library";

function MusicIcon({ name }: { name: MusicIconName }) {
  if (name === "play") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
      </svg>
    );
  }

  if (name === "pause") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h3.8v14H7V5Zm6.2 0H17v14h-3.8V5Z" />
      </svg>
    );
  }

  if (name === "prev" || name === "next") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={name === "prev" ? "M6 5h2.4v14H6V5Zm12.2.7v12.6L9.2 12l9-6.3Z" : "M15.6 5H18v14h-2.4V5ZM5.8 18.3V5.7l9 6.3-9 6.3Z"} />
      </svg>
    );
  }

  if (name === "volume") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.2h4.1L13.6 5v14l-5.5-4.2H4V9.2Zm12.2-.9a5.7 5.7 0 0 1 0 7.4l-1.6-1.3a3.6 3.6 0 0 0 0-4.8l1.6-1.3Z" />
      </svg>
    );
  }

  if (name === "add") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7.4 6 4.6 4.6L16.6 6 18 7.4 13.4 12l4.6 4.6-1.4 1.4-4.6-4.6L7.4 18 6 16.6l4.6-4.6L6 7.4 7.4 6Z" />
      </svg>
    );
  }

  if (name === "library") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6.2h10.6v2H5v-2Zm0 4.8h14v2H5v-2Zm0 4.8h8.8v2H5v-2Zm11.2-.1 2.1 2.1 2.9-3 1.3 1.3-4.2 4.3-3.4-3.4 1.3-1.3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.6 6.4A7.7 7.7 0 0 1 19.7 9h-2.4a5.7 5.7 0 0 0-8.4-1.1L7.2 9.6H11v2H4V4.6h2v3.6l1.6-1.8Zm8.8 11.2A7.7 7.7 0 0 1 4.3 15h2.4a5.7 5.7 0 0 0 8.4 1.1l1.7-1.7H13v-2h7v7h-2v-3.6l-1.6 1.8Z" />
    </svg>
  );
}

export default function ImmersiveMusicPage({ header }: { header: React.ReactNode }) {
  const state = useAudioState();
  const actions = useAudioActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "playlist">("search");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const lyricLineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const lyricScrollAnimationRef = useRef<number | null>(null);

  const cancelLyricScrollAnimation = useCallback(() => {
    if (lyricScrollAnimationRef.current != null) {
      cancelAnimationFrame(lyricScrollAnimationRef.current);
      lyricScrollAnimationRef.current = null;
    }
  }, []);

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
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelector(".page-fade-in")?.classList.add("page-fade-in-ready");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    return cancelLyricScrollAnimation;
  }, [cancelLyricScrollAnimation]);

  useEffect(() => {
    const container = lyricsRef.current;
    const activeLine = lyricLineRefs.current[state.lyricIndex];
    if (!container || !activeLine) return;

    const top = activeLine.offsetTop - (container.clientHeight - activeLine.clientHeight) / 2;
    animateLyricScroll(container, Math.max(0, top), lyricScrollAnimationRef);
  }, [state.lyricIndex, state.lyrics]);

  const seek = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    actions.seekTo(((e.clientX - rect.left) / rect.width) * (state.duration || 0));
  }, [actions, state.duration]);

  const loopLabel = state.loopMode === "single" ? "单曲循环" : state.loopMode === "random" ? "随机播放" : "列表循环";
  const coverClassName = `music-player-art ${state.currentSong && !state.isPlaying ? "music-player-art-paused" : ""}`;
  const backgroundStyle = albumPic
    ? ({ "--music-cover-bg": `url("${albumPic}")` } as React.CSSProperties)
    : undefined;

  return (
    <>
      <div className="music-cover-backdrop" style={backgroundStyle} aria-hidden="true" />
      <div className="music-ambient" aria-hidden="true" />
      <div className="music-vignette" aria-hidden="true" />
      {header}
      <div className="music-page-volume">
        <MusicIcon name="volume" />
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(state.volume * 100)}
          onChange={(e) => actions.setVolume(parseInt(e.target.value, 10) / 100)}
          aria-label="音量"
        />
      </div>

      <section className="music-page-layout page-fade-in">
        <aside className="music-player-main" aria-label="音乐播放器">
          <div className={coverClassName}>
            <span
              style={albumPic ? { backgroundImage: `url("${albumPic}")` } : undefined}
            />
          </div>

          <div className="music-player-info">
            <h1>{state.currentSong?.name ?? "未选择歌曲"}</h1>
            <p>{artistName || "搜索歌曲开始播放"}</p>
          </div>

          <div
            className="music-player-bar"
            onClick={seek}
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={Math.round(state.duration)}
            aria-valuenow={Math.round(state.currentTime)}
          >
            <div className="music-player-bar-track">
              <div className="music-player-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="music-player-bar-times">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>

          <div className="music-page-controls">
            <button
              type="button"
              onClick={() => actions.setLoopMode(
                state.loopMode === "list" ? "single" : state.loopMode === "single" ? "random" : "list",
              )}
              title={loopLabel}
              aria-label={loopLabel}
            >
              <MusicIcon name="loop" />
            </button>
            <button type="button" onClick={actions.playPrev} disabled={state.playlist.length === 0} aria-label="上一首">
              <MusicIcon name="prev" />
            </button>
            <button type="button" className="music-page-play" onClick={actions.togglePlay} aria-label={state.isPlaying ? "暂停" : "播放"}>
              <MusicIcon name={state.isPlaying ? "pause" : "play"} />
            </button>
            <button type="button" onClick={actions.playNext} disabled={state.playlist.length === 0} aria-label="下一首">
              <MusicIcon name="next" />
            </button>
          </div>
        </aside>

        <div className="music-page-lyrics" ref={lyricsRef} aria-label="歌词">
          {state.lyrics && state.lyrics.length > 0 ? (
            state.lyrics.map((line, i) => (
              <p
                key={`${line.time}-${i}`}
                ref={(node) => {
                  lyricLineRefs.current[i] = node;
                }}
                className={[
                  i === state.lyricIndex ? "music-lyric-active" : "music-lyric-dimmed",
                  line.isHarmony ? "music-lyric-harmony" : "",
                ].filter(Boolean).join(" ")}
              >
                {line.text}
              </p>
            ))
          ) : (
            <>
              <p className="music-lyric-dimmed">城市慢慢沉入夜色</p>
              <p className="music-lyric-active">让音乐替此刻发光</p>
              <p className="music-lyric-dimmed">搜索一首歌开始播放</p>
            </>
          )}
        </div>

        <button
          type="button"
          className="music-library-toggle"
          onClick={() => setIsLibraryOpen((value) => !value)}
          aria-expanded={isLibraryOpen}
          aria-controls="music-page-library"
        >
          <MusicIcon name="library" />
          <span>音乐库</span>
          <small>{state.playlist.length}</small>
        </button>

        <aside
          id="music-page-library"
          className={`music-page-library ${isLibraryOpen ? "music-page-library-open" : ""}`}
          aria-label="搜索与播放列表"
          aria-hidden={!isLibraryOpen}
        >
          <div className="music-page-library-head">
            <div className="music-page-tabs">
              <button
                type="button"
                className={activeTab === "search" ? "music-tab-active" : ""}
                onClick={() => setActiveTab("search")}
              >
                搜索
              </button>
              <button
                type="button"
                className={activeTab === "playlist" ? "music-tab-active" : ""}
                onClick={() => setActiveTab("playlist")}
              >
                列表 {state.playlist.length}
              </button>
            </div>
            <button
              type="button"
              className="music-library-close"
              onClick={() => setIsLibraryOpen(false)}
              aria-label="收起音乐库"
            >
              <MusicIcon name="close" />
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
                      type="button"
                      className="music-add-btn"
                      onClick={() => { actions.addToPlaylist(s); actions.playSong(s); }}
                      aria-label={`播放 ${s.name}`}
                    >
                      <MusicIcon name="add" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "playlist" && (
            <div className="music-playlist-area">
              {state.playlist.length === 0 ? (
                <div className="music-player-results-status">播放列表为空</div>
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
                      type="button"
                      className="music-remove-btn"
                      onClick={(e) => { e.stopPropagation(); actions.removeFromPlaylist(i); }}
                      aria-label={`移除 ${song.name}`}
                    >
                      <MusicIcon name="close" />
                    </button>
                  </div>
                ))
              )}
              {state.playlist.length > 0 && (
                <button type="button" className="music-clear-btn" onClick={actions.clearPlaylist}>清空列表</button>
              )}
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
