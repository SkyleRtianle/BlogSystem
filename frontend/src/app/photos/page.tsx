"use client";

import { ChangeEvent, MouseEvent, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  authHeaders,
  clearAuthSession,
  ensureAuthorized,
  redirectToLogin,
  requireAuthToken,
  useAuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import ImageCropper from "@/components/ImageCropper";
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

type ContextMenuState = {
  albumId: string;
  x: number;
  y: number;
};

const ALBUM_PREFIX = "__album:";

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

function resolveImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) return imageUrl;
  return `${API_BASE_URL}/photos/file/${imageUrl}`;
}

function getFileTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, "").trim() || "本地照片";
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

export default function PhotosPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [fetchComplete, setFetchComplete] = useState(false);
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAlbumTitleRef = useRef("");
  const lightboxTouchStartXRef = useRef<number | null>(null);
  const cropperQueueRef = useRef<File[]>([]);
  const cropperResultsRef = useRef<File[]>([]);
  const [activeCropperFile, setActiveCropperFile] = useState<File | null>(null);
  const currentUser = useAuthUser();
  const albums = useMemo(() => buildAlbums(photos), [photos]);
  const activeAlbum = albums.find((album) => album.id === activeAlbumId) ?? null;
  const activeAlbumPhotoCount = activeAlbum?.photos.length ?? 0;
  const activePhoto = activeAlbum && activePhotoIndex !== null ? activeAlbum.photos[activePhotoIndex] : null;

  const fetchPhotos = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/photos`, {
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) {
        throw new Error("照片列表加载失败");
      }
      const data: { photos: Photo[]; total: number } = await response.json();
      setPhotos(data.photos);
    } catch (error) {
      setPhotos([]);
      console.error(error);
    } finally {
      setFetchComplete(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPhotos();
    }, 0);
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

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [contextMenu]);

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
        setActivePhotoIndex((currentIndex) => {
          if (currentIndex === null) return currentIndex;
          return (currentIndex - 1 + activeAlbumPhotoCount) % activeAlbumPhotoCount;
        });
      }
      if (event.key === "ArrowRight") {
        if (activeAlbumPhotoCount === 0) return;
        setActivePhotoIndex((currentIndex) => {
          if (currentIndex === null) return currentIndex;
          return (currentIndex + 1) % activeAlbumPhotoCount;
        });
      }
      if (event.key === "Escape") setActivePhotoIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAlbumPhotoCount, activePhoto]);

  const uploadPhotos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsSubmitting(true);
      try {
        const token = requireAuthToken();
        if (!token) return;

        const createdPhotos: Photo[] = [];
        const albumId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const title = pendingAlbumTitleRef.current.trim() || getFileTitle(files[0]);

        for (const file of files) {
          const formData = new FormData();
          formData.append("title", title);
          formData.append("description", `${ALBUM_PREFIX}${albumId}__`);
          formData.append("file", file);

          const response = await fetch(`${API_BASE_URL}/photos`, {
            method: "POST",
            headers: authHeaders(token),
            body: formData,
          });
          ensureAuthorized(response);
          if (!response.ok) throw new Error("照片添加失败");
          createdPhotos.push(await response.json());
        }

        setPhotos((current) => [...createdPhotos.reverse(), ...current]);
      } catch (error) {
        console.error(error);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
        pendingAlbumTitleRef.current = "";
        setIsSubmitting(false);
      }
    },
    [],
  );

  const selectPhotos = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    cropperQueueRef.current = [...files];
    cropperResultsRef.current = [];
    setActiveCropperFile(files[0]);
  }, []);

  const handlePhotoCrop = useCallback(async (dataUrl: string) => {
    const current = cropperQueueRef.current[0];
    if (!current) return;
    try {
      const cropped = await dataUrlToFile(dataUrl, current.name);
      cropperResultsRef.current.push(cropped);
    } catch {
      cropperResultsRef.current.push(current);
    }
    cropperQueueRef.current = cropperQueueRef.current.slice(1);
    const nextFile = cropperQueueRef.current[0] || null;
    setActiveCropperFile(nextFile);
    if (!nextFile && cropperResultsRef.current.length > 0) {
      void uploadPhotos(cropperResultsRef.current);
    }
  }, [uploadPhotos]);

  const handlePhotoSkip = useCallback(() => {
    const current = cropperQueueRef.current[0];
    if (!current) return;
    cropperResultsRef.current.push(current);
    cropperQueueRef.current = cropperQueueRef.current.slice(1);
    const nextFile = cropperQueueRef.current[0] || null;
    setActiveCropperFile(nextFile);
    if (!nextFile && cropperResultsRef.current.length > 0) {
      void uploadPhotos(cropperResultsRef.current);
    }
  }, [uploadPhotos]);

  const handlePhotoCropperClose = useCallback(() => {
    cropperQueueRef.current = [];
    cropperResultsRef.current = [];
    setActiveCropperFile(null);
  }, []);

  const openAlbumPicker = useCallback(() => {
    pendingAlbumTitleRef.current = `相册 ${albums.length + 1}`;
    fileInputRef.current?.click();
  }, [albums.length]);

  const openContextMenu = useCallback((event: MouseEvent, albumId: string) => {
    event.preventDefault();
    setContextMenu({ albumId, x: event.clientX, y: event.clientY });
  }, []);

  const deleteAlbum = useCallback(async (albumId: string) => {
    const album = albums.find((item) => item.id === albumId);
    if (!album) return;

    setContextMenu(null);
    setIsSubmitting(true);
    try {
      const token = requireAuthToken();
      if (!token) return;
      for (const photo of album.photos) {
        const response = await fetch(`${API_BASE_URL}/photos/${photo.id}`, {
          method: "DELETE",
          headers: authHeaders(token),
        });
        ensureAuthorized(response);
        if (!response.ok) throw new Error("相册删除失败");
      }
      setPhotos((current) => current.filter((photo) => !album.photos.some((item) => item.id === photo.id)));
      if (activeAlbumId === albumId) setActiveAlbumId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeAlbumId, albums]);

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="照片墙" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />
      <section className="photo-wall-layout page-fade-in mx-auto max-w-[1500px] px-4 py-8 sm:px-8 xl:px-[80px]">
        <div className="photo-wall-hero">
          <div className={`photo-wall-heading ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: "0ms" } : undefined}>
            <div className="photo-wall-title">
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={selectPhotos}
              />
              <button
                className="photo-upload-button"
                disabled={isSubmitting}
                type="button"
                onClick={openAlbumPicker}
              >
                {isSubmitting ? "处理中" : "上传相册"}
              </button>
            </div>
          </div>
        </div>

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
          <div className={`photo-empty-state ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: "80ms" } : undefined}>
            暂无相册。点击上传相册后，会以堆叠卡片形式展示在这里。
          </div>
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
              onContextMenu={(event) => openContextMenu(event, album.id)}
            >
              <div className="photo-stack-stage" title="右键删除相册">
                {isStackedAlbum && (
                  <>
                    <LoadableImage src={resolveImageUrl(second.image_url)} alt="" className="photo-stack-copy photo-stack-copy-one" />
                    <LoadableImage src={resolveImageUrl(third.image_url)} alt="" className="photo-stack-copy photo-stack-copy-two" />
                    <LoadableImage src={resolveImageUrl(fourth.image_url)} alt="" className="photo-stack-copy photo-stack-copy-three" />
                  </>
                )}
                <LoadableImage
                  src={resolveImageUrl(cover.image_url)} alt={cover.title}
                  className="photo-stack-image"
                />
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
      </section>

      {activeAlbum && (
        <div
          className="photo-album-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setActivePhotoIndex(null);
            setActiveAlbumId(null);
          }}
        >
          <div className="photo-album-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="photo-album-modal-head">
              <div>
                <h2>{activeAlbum.title}</h2>
                <p>{activeAlbum.photos.length} 张照片</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePhotoIndex(null);
                  setActiveAlbumId(null);
                }}
              >
                关闭
              </button>
            </div>
            <div className="photo-album-modal-grid">
              {activeAlbum.photos.map((photo, index) => (
                <figure
                  key={photo.id}
                  className="photo-polaroid-card"
                  style={{
                    "--photo-rotate": `${((index % 5) - 2) * 2.2}deg`,
                    animationDelay: `${index * 90}ms`,
                  } as React.CSSProperties}
                  onClick={() => setActivePhotoIndex(index)}
                >
                  <LoadableImage src={resolveImageUrl(photo.image_url)} alt={photo.title} />
                  <figcaption>{index + 1}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}

      {activePhoto && activeAlbum && activePhotoIndex !== null && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setActivePhotoIndex(null)}
          onTouchEnd={endPhotoSwipe}
          onTouchStart={startPhotoSwipe}
        >
          <button
            aria-label="上一张"
            className="photo-lightbox-nav photo-lightbox-prev"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showPreviousPhoto();
            }}
          >
            ‹
          </button>
          <div className="photo-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <LoadableImage src={resolveImageUrl(activePhoto.image_url)} alt={activePhoto.title} />
            <p>{activePhotoIndex + 1} / {activeAlbum.photos.length}</p>
          </div>
          <button
            aria-label="下一张"
            className="photo-lightbox-nav photo-lightbox-next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              showNextPhoto();
            }}
          >
            ›
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          className="photo-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => void deleteAlbum(contextMenu.albumId)}>
            删除相册
          </button>
        </div>
      )}
      {activeCropperFile && (
        <ImageCropper
          file={activeCropperFile}
          onCrop={handlePhotoCrop}
          onSkip={handlePhotoSkip}
          onClose={handlePhotoCropperClose}
        />
      )}
    </main>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
