"use client";

import { useEffect, useSyncExternalStore } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export type SongInfo = {
  id: number;
  name: string;
  artists: { name: string }[];
  album: { id: number; name: string; picUrl: string };
  duration: number;
};

export type LyricLine = { time: number; text: string; isHarmony?: boolean };

export type AudioState = {
  currentSong: SongInfo | null;
  playlist: SongInfo[];
  playlistIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[] | null;
  lyricIndex: number;
  loopMode: "list" | "single" | "random";
  volume: number;
};

type Listener = () => void;

function parseLRC(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  const harmonyRe = /^(?:[（(]\s*)?(?:和声|合声|伴唱|副歌|chorus|backing\s*vocals?|harmony)(?:\s*[：:）)]|\s+)/i;
  for (const line of raw.split("\n")) {
    re.lastIndex = 0;
    const m = re.exec(line.trim());
    if (m) {
      const mins = parseInt(m[1], 10);
      const secs = parseInt(m[2], 10);
      const ms = parseInt(m[3].padEnd(3, "0"), 10);
      const text = m[4].trim();
      if (text) lines.push({ time: mins * 60 + secs + ms / 1000, text, isHarmony: harmonyRe.test(text) });
    }
  }
  return lines;
}

// ── Module-level singleton ──

let _audio: HTMLAudioElement | null = null;
const _listeners = new Set<Listener>();
const _state: AudioState = {
  currentSong: null,
  playlist: [],
  playlistIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  lyrics: null,
  lyricIndex: -1,
  loopMode: "list",
  volume: 0.7,
};

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.volume = _state.volume;

    _audio.addEventListener("timeupdate", () => {
      _state.currentTime = _audio?.currentTime ?? 0;
      if (_state.lyrics) {
        let idx = -1;
        for (let i = 0; i < _state.lyrics.length; i++) {
          if (_state.currentTime >= _state.lyrics[i].time) idx = i;
          else break;
        }
        _state.lyricIndex = idx;
      }
      notify();
    });

    _audio.addEventListener("loadedmetadata", () => {
      _state.duration = _audio?.duration ?? 0;
      notify();
    });

    _audio.addEventListener("play", () => {
      _state.isPlaying = true;
      notify();
    });

    _audio.addEventListener("pause", () => {
      _state.isPlaying = false;
      notify();
    });

    _audio.addEventListener("ended", () => {
      _state.isPlaying = false;
      playNext();
    });

    _audio.addEventListener("error", () => {
      _state.isPlaying = false;
      notify();
    });
  }
  return _audio;
}

let _cachedSnapshot: AudioState = { ..._state };

function notify() {
  _cachedSnapshot = { ..._state };
  _listeners.forEach((fn) => fn());
}

function persistPlaylist() {
  try {
    window.localStorage.setItem("music.playlist", JSON.stringify(_state.playlist));
    window.localStorage.setItem("music.index", String(_state.playlistIndex));
    if (_state.currentSong) {
      window.localStorage.setItem("music.current", JSON.stringify(_state.currentSong));
    }
  } catch { /* ignore */ }
}

function mergeSongDetail(detail: SongInfo | null | undefined) {
  if (!detail?.album?.picUrl) return;
  const mergeAlbum = (song: SongInfo): SongInfo => ({
    ...song,
    name: song.name || detail.name,
    artists: song.artists.length > 0 ? song.artists : detail.artists,
    duration: song.duration || detail.duration,
    album: {
      ...song.album,
      id: song.album.id || detail.album.id,
      name: song.album.name || detail.album.name,
      picUrl: song.album.picUrl || detail.album.picUrl,
    },
  });

  if (_state.currentSong?.id === detail.id) {
    _state.currentSong = mergeAlbum(_state.currentSong);
  }
  _state.playlist = _state.playlist.map((song) => (
    song.id === detail.id ? mergeAlbum(song) : song
  ));
}

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem("music.playlist");
    if (raw) {
      _state.playlist = JSON.parse(raw);
      _state.playlistIndex = parseInt(window.localStorage.getItem("music.index") ?? "-1", 10);
      const cur = window.localStorage.getItem("music.current");
      if (cur) _state.currentSong = JSON.parse(cur);
    }
  } catch { /* ignore */ }
}

// ── Public API ──

export function getAudioState(): AudioState {
  return _cachedSnapshot;
}

export function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function setVolume(v: number) {
  _state.volume = Math.max(0, Math.min(1, v));
  const a = getAudio();
  a.volume = _state.volume;
  notify();
}

export function togglePlay() {
  const a = getAudio();
  if (!a.src) {
    if (_state.currentSong) _resolveAudioSource(_state.currentSong);
    return;
  }
  if (a.paused) a.play().catch(() => {});
  else a.pause();
}

export function seekTo(time: number) {
  const a = getAudio();
  a.currentTime = Math.max(0, Math.min(time, _state.duration || 0));
}

export function playSong(song: SongInfo) {
  loadPersisted();
  const idx = _state.playlist.findIndex((s) => s.id === song.id);
  if (idx >= 0) {
    _state.playlistIndex = idx;
  } else {
    _state.playlist.push(song);
    _state.playlistIndex = _state.playlist.length - 1;
  }
  _resolveAndPlay(song);
}

export function playAtIndex(index: number) {
  if (index < 0 || index >= _state.playlist.length) return;
  _state.playlistIndex = index;
  _resolveAndPlay(_state.playlist[index]);
}

function _resolveAudioSource(song: SongInfo) {
  Promise.all([
    fetch(`${API_BASE}/music/song?id=${song.id}`).then((r) => r.json()),
    fetch(`${API_BASE}/music/lyric?id=${song.id}`).then((r) => r.json()),
  ])
    .then(([urlData, lrcData]) => {
      if (!urlData.url) return;
      const raw = lrcData.tlyric || lrcData.lyric || "";
      if (raw) {
        const parsed = parseLRC(raw);
        _state.lyrics = parsed.length > 0 ? parsed : null;
      }
      mergeSongDetail(urlData.song);
      persistPlaylist();
      const a = getAudio();
      a.src = urlData.url;
      a.load();
      notify();
    })
    .catch(() => { notify(); });
}

function _resolveAndPlay(song: SongInfo) {
  _state.currentSong = song;
  _state.isPlaying = false;
  _state.currentTime = 0;
  _state.duration = 0;
  _state.lyrics = null;
  _state.lyricIndex = -1;
  persistPlaylist();
  notify();

  Promise.all([
    fetch(`${API_BASE}/music/song?id=${song.id}`).then((r) => r.json()),
    fetch(`${API_BASE}/music/lyric?id=${song.id}`).then((r) => r.json()),
  ])
    .then(([urlData, lrcData]) => {
      if (!urlData.url) throw new Error("no url");
      const raw = lrcData.tlyric || lrcData.lyric || "";
      if (raw) {
        const parsed = parseLRC(raw);
        _state.lyrics = parsed.length > 0 ? parsed : null;
      }
      mergeSongDetail(urlData.song);
      persistPlaylist();
      const a = getAudio();
      a.src = urlData.url;
      a.load();
      a.play().catch(() => {});
    })
    .catch(() => {
      notify();
    });
}

export function playNext() {
  if (_state.playlist.length === 0) return;
  let nextIdx: number;
  if (_state.loopMode === "single") {
    nextIdx = _state.playlistIndex;
  } else if (_state.loopMode === "random") {
    nextIdx = Math.floor(Math.random() * _state.playlist.length);
  } else {
    nextIdx = (_state.playlistIndex + 1) % _state.playlist.length;
  }
  playAtIndex(nextIdx);
}

export function playPrev() {
  if (_state.playlist.length === 0) return;
  const prevIdx = _state.playlistIndex <= 0
    ? _state.playlist.length - 1
    : _state.playlistIndex - 1;
  playAtIndex(prevIdx);
}

export function addToPlaylist(song: SongInfo) {
  loadPersisted();
  if (!_state.playlist.some((s) => s.id === song.id)) {
    _state.playlist.push(song);
    if (_state.playlistIndex < 0) _state.playlistIndex = 0;
    persistPlaylist();
    notify();
  }
}

export function removeFromPlaylist(index: number) {
  if (index < 0 || index >= _state.playlist.length) return;
  const wasCurrent = index === _state.playlistIndex;
  _state.playlist.splice(index, 1);
  if (_state.playlist.length === 0) {
    _state.playlistIndex = -1;
    _state.currentSong = null;
    _state.isPlaying = false;
    const a = getAudio();
    a.pause();
    a.src = "";
  } else if (wasCurrent) {
    _state.playlistIndex = Math.min(index, _state.playlist.length - 1);
    _resolveAndPlay(_state.playlist[_state.playlistIndex]);
  } else if (index < _state.playlistIndex) {
    _state.playlistIndex--;
  }
  persistPlaylist();
  notify();
}

export function clearPlaylist() {
  _state.playlist = [];
  _state.playlistIndex = -1;
  _state.currentSong = null;
  _state.isPlaying = false;
  _state.lyrics = null;
  _state.lyricIndex = -1;
  const a = getAudio();
  a.pause();
  a.src = "";
  persistPlaylist();
  notify();
}

export function setLoopMode(mode: AudioState["loopMode"]) {
  _state.loopMode = mode;
  notify();
}

export async function searchSongs(keyword: string, limit = 12): Promise<SongInfo[]> {
  const res = await fetch(`${API_BASE}/music/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
  if (!res.ok) throw new Error("搜索失败");
  const data = await res.json();
  return data.songs ?? [];
}

const _serverSnapshot: AudioState = {
  currentSong: null,
  playlist: [],
  playlistIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  lyrics: null,
  lyricIndex: -1,
  loopMode: "list",
  volume: 0.7,
};

export function useAudioState(): AudioState {
  const state = useSyncExternalStore(
    subscribe,
    getAudioState,
    () => _serverSnapshot,
  );

  // Restore persisted playlist on first mount
  useEffect(() => {
    loadPersisted();
    notify();
    if (_state.currentSong && !getAudio().src) {
      _resolveAudioSource(_state.currentSong);
    }
  }, []);

  return state;
}

export function useAudioActions() {
  return {
    playSong,
    togglePlay,
    playNext,
    playPrev,
    playAtIndex,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    setLoopMode,
    setVolume,
    seekTo,
    searchSongs,
  };
}
