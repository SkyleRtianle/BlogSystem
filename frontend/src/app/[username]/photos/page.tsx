"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import PublicHeader from "@/components/PublicHeader";
import LoadableImage from "@/components/LoadableImage";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type Photo = {
  id: number;
  title: string;
  image_url: string;
  description: string;
  created_at: string;
};

type PhotoAlbum = {
  id: string;
  title: string;
  photos: Photo[];
  created_at: string;
};

const ALBUM_PREFIX = "__album:";

function resolveImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) return imageUrl;
  return `${API_BASE_URL}/photos/file/${imageUrl}`;
}

function getAlbumId(photo: Photo) {
  if (photo.description.startsWith(ALBUM_PREFIX)) {
    return photo.description.slice(ALBUM_PREFIX.length).replace(/__$/, "") || `photo-${photo.id}`;
  }
  return `photo-${photo.id}`;
}

function buildAlbums(photos: Photo[]) {
  const albumMap = new Map<string, PhotoAlbum>();
  for (const photo of photos) {
    const albumId = getAlbumId(photo);
    const existing = albumMap.get(albumId);
    if (existing) {
      existing.photos.push(photo);
      if (new Date(photo.created_at) > new Date(existing.created_at)) existing.created_at = photo.created_at;
    } else {
      albumMap.set(albumId, {
        id: albumId,
        title: photo.title || "未命名相册",
        photos: [photo],
        created_at: photo.created_at,
      });
    }
  }
  return Array.from(albumMap.values()).sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export default function PublicPhotosPage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [fetchComplete, setFetchComplete] = useState(false);
  const lightboxTouchStartXRef = useRef<number | null>(null);

  const albums = useMemo(() => buildAlbums(photos), [photos]);
  const activeAlbum = albums.find((album) => album.id === activeAlbumId) ?? null;
  const activeAlbumPhotoCount = activeAlbum?.photos.length ?? 0;
  const activePhoto = activeAlbum && activePhotoIndex !== null ? activeAlbum.photos[activePhotoIndex] : null;

  const fetchPhotos = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/public/${username}/photos`);
      if (!response.ok) throw new Error("照片列表加载失败");
      const data: { photos: Photo[]; total: number } = await response.json();
      setPhotos(data.photos);
    } catch (error) {
      setPhotos([]);
      console.error(error);
    } finally {
      setFetchComplete(true);
    }
  }, [username]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPhotos(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPhotos]);

  useEffect(() => {
    if (fetchComplete) {
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDataReady(true);
        });
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [fetchComplete]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelector(".page-fade-in")?.classList.add("page-fade-in-ready");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const movePhoto = (direction: -1 | 1) => {
    if (activeAlbumPhotoCount === 0) return;
    setActivePhotoIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return (currentIndex + direction + activeAlbumPhotoCount) % activeAlbumPhotoCount;
    });
  };

  const showPreviousPhoto = () => movePhoto(-1);
  const showNextPhoto = () => movePhoto(1);

  const startPhotoSwipe = (event: TouchEvent<HTMLDivElement>) => {
    lightboxTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const endPhotoSwipe = (event: TouchEvent<HTMLDivElement>) => {
    const startX = lightboxTouchStartXRef.current;
    lightboxTouchStartXRef.current = null;
    if (startX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 48) return;
    if (deltaX > 0) showPreviousPhoto();
    else showNextPhoto();
  };

  useEffect(() => {
    if (!activePhoto) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        if (activeAlbumPhotoCount === 0) return;
        setActivePhotoIndex((ci) => ci === null ? ci : (ci - 1 + activeAlbumPhotoCount) % activeAlbumPhotoCount);
      }
      if (event.key === "ArrowRight") {
        if (activeAlbumPhotoCount === 0) return;
        setActivePhotoIndex((ci) => ci === null ? ci : (ci + 1) % activeAlbumPhotoCount);
      }
      if (event.key === "Escape") setActivePhotoIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAlbumPhotoCount, activePhoto]);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <PublicHeader active="照片墙" username={username} isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} />

      <section className="photo-wall-layout page-fade-in mx-auto max-w-[1500px] px-4 py-8 sm:px-8 xl:px-[80px] flex flex-col justify-center min-h-[calc(100vh-120px)]">
        {!fetchComplete && (
          <div className="photo-skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="photo-skeleton-card">
                <div className="photo-skeleton-stack">
                  <div className="photo-skeleton-badge" />
                </div>
                <div className="photo-skeleton-title" />
              </div>
            ))}
          </div>
        )}

        {fetchComplete && albums.length === 0 && (
          <div className={`photo-empty-state ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: "80ms" } : undefined}>暂无相册。</div>
        )}

        {fetchComplete && <div className="photo-album-grid">
          {albums.map((album, index) => {
            const cover = album.photos[0];
            const isStackedAlbum = album.photos.length > 1;
            const second = album.photos[1] ?? cover;
            const third = album.photos[2] ?? second;
            const fourth = album.photos[3] ?? third;
            return (
              <article
                key={album.id}
                className={`photo-album-card ${isStackedAlbum ? "photo-album-card-stacked" : "photo-album-card-single"} ${dataReady ? "card-fly-in" : "card-init-hidden"}`}
                style={dataReady ? { animationDelay: `${index * 90}ms` } : undefined}
                onClick={() => {
                  setActivePhotoIndex(null);
                  setActiveAlbumId(album.id);
                }}
              >
                <div className="photo-stack-stage">
                  {isStackedAlbum && (
                    <>
                      <LoadableImage src={resolveImageUrl(second.image_url)} alt="" className="photo-stack-copy photo-stack-copy-one" />
                      <LoadableImage src={resolveImageUrl(third.image_url)} alt="" className="photo-stack-copy photo-stack-copy-two" />
                      <LoadableImage src={resolveImageUrl(fourth.image_url)} alt="" className="photo-stack-copy photo-stack-copy-three" />
                    </>
                  )}
                  <LoadableImage src={resolveImageUrl(cover.image_url)} alt={cover.title} className="photo-stack-image" />
                  <span className="photo-count-badge">{album.photos.length} 张</span>
                </div>
                <div className="photo-card-meta">
                  <h2>{album.title || `${index + 1}`}</h2>
                  <time>{formatDate(album.created_at)}</time>
                </div>
              </article>
            );
          })}
        </div>}

        <div className={`mt-[100px] flex justify-center ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: "400ms" } : undefined}>
          <h2 className="photo-wall-glass-title">{username} 的照片墙</h2>
        </div>
      </section>

      {activeAlbum && (
        <div className="photo-album-modal" role="dialog" aria-modal="true"
          onClick={() => { setActivePhotoIndex(null); setActiveAlbumId(null); }}>
          <div className="photo-album-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="photo-album-modal-head">
              <div>
                <h2>{activeAlbum.title}</h2>
                <p>{activeAlbum.photos.length} 张照片</p>
              </div>
              <button type="button" onClick={() => { setActivePhotoIndex(null); setActiveAlbumId(null); }}>关闭</button>
            </div>
            <div className="photo-album-modal-grid">
              {activeAlbum.photos.map((photo, index) => (
                <figure key={photo.id} className="photo-polaroid-card"
                  style={{ "--photo-rotate": `${((index % 5) - 2) * 2.2}deg`, animationDelay: `${index * 90}ms` } as React.CSSProperties}
                  onClick={() => setActivePhotoIndex(index)}>
                  <LoadableImage src={resolveImageUrl(photo.image_url)} alt={photo.title} className="photo-polaroid-img" />
                  <figcaption>{index + 1}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}

      {activePhoto && activeAlbum && activePhotoIndex !== null && (
        <div className="photo-lightbox" role="dialog" aria-modal="true"
          onClick={() => setActivePhotoIndex(null)} onTouchEnd={endPhotoSwipe} onTouchStart={startPhotoSwipe}>
          <button aria-label="上一张" className="photo-lightbox-nav photo-lightbox-prev" type="button"
            onClick={(e) => { e.stopPropagation(); showPreviousPhoto(); }}>‹</button>
          <div className="photo-lightbox-frame" onClick={(e) => e.stopPropagation()}>
            <LoadableImage src={resolveImageUrl(activePhoto.image_url)} alt={activePhoto.title} className="photo-lightbox-img" />
            <p>{activePhotoIndex + 1} / {activeAlbum.photos.length}</p>
          </div>
          <button aria-label="下一张" className="photo-lightbox-nav photo-lightbox-next" type="button"
            onClick={(e) => { e.stopPropagation(); showNextPhoto(); }}>›</button>
        </div>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
