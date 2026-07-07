"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, TouchEvent, WheelEvent } from "react";
import { requireAuthToken, redirectToLogin } from "@/lib/auth";
import { useAppSettings } from "@/lib/useAppSettings";

const TAGLINES = [
  "From every quiet day, I write and shine.",
  "记录每一个安静的日子，书写与发光。",
  "Share stories, capture moments, connect hearts.",
];

export default function WallpaperPage() {
  const router = useRouter();
  const touchStartY = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { wallpaperUrl, setWallpaperUrl, resetWallpaper } = useAppSettings();
  const [wallpaperError, setWallpaperError] = useState("");
  const [isProcessingWallpaper, setIsProcessingWallpaper] = useState(false);

  useEffect(() => {
    if (!requireAuthToken()) {
      redirectToLogin();
    }
  }, []);

  const enterHome = useCallback(() => {
    router.push("/home");
  }, [router]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY > 18) {
        enterHome();
      }
    },
    [enterHome],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;
      if (startY != null && endY != null && endY - startY > 42) {
        enterHome();
      }
    },
    [enterHome],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleWallpaperChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setWallpaperError("请选择图片文件。");
        return;
      }

      setIsProcessingWallpaper(true);
      setWallpaperError("");
      try {
        const nextWallpaper = await compressWallpaper(file);
        setWallpaperUrl(nextWallpaper);
      } catch (error) {
        setWallpaperError(
          isQuotaExceededError(error)
            ? "本地存储空间不足，请换一张更小的图片。"
            : "壁纸处理失败，请换一张图片再试。",
        );
      } finally {
        setIsProcessingWallpaper(false);
      }
    },
    [setWallpaperUrl],
  );

  return (
    <main className="home-shell h-screen overflow-hidden">
      <div className="home-global-wallpaper" style={{ filter: "saturate(0.9)" }} />
      <section
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 flex h-screen items-center justify-center px-6 text-center"
      >
        <div className="drop-shadow-[0_10px_24px_rgba(15,23,42,0.38)]">
          <h1 className="text-7xl font-bold text-white sm:text-8xl">Skyler Blog</h1>
          <TypewriterText texts={TAGLINES} />
          <button
            type="button"
            onClick={enterHome}
            className="mt-20 text-5xl font-light text-white/90 transition hover:translate-y-1"
            aria-label="进入主页"
          >
            ⌄
          </button>
          <p className="mt-3 text-sm font-medium text-white/75">向下滑动进入主页</p>
        </div>
      </section>
      <div className="wallpaper-custom-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleWallpaperChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isProcessingWallpaper}
          className="wallpaper-custom-button"
        >
          {isProcessingWallpaper ? "处理中..." : "自定义壁纸"}
        </button>
        <button
          type="button"
          onClick={resetWallpaper}
          disabled={wallpaperUrl === "/images/home-background.png" || isProcessingWallpaper}
          className="wallpaper-custom-button wallpaper-custom-button-subtle"
        >
          恢复默认
        </button>
        {wallpaperError && <p className="wallpaper-custom-error">{wallpaperError}</p>}
      </div>
    </main>
  );
}

function TypewriterText({
  texts,
  speed = 60,
  deleteSpeed = 30,
  pause = 2000,
}: {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pause?: number;
}) {
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];

    if (!isDeleting) {
      if (charIndex < currentText.length) {
        const timer = setTimeout(() => {
          setDisplayText(currentText.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, speed);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => setIsDeleting(true), pause);
        return () => clearTimeout(timer);
      }
    } else {
      if (charIndex > 0) {
        const timer = setTimeout(() => {
          setDisplayText(currentText.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, deleteSpeed);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setIsDeleting(false);
          setTextIndex((textIndex + 1) % texts.length);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [charIndex, isDeleting, textIndex, texts, speed, deleteSpeed, pause]);

  return (
    <p className="mt-5 text-xl font-medium text-white/92 sm:text-2xl">
      {displayText}
      <span className="ml-1 inline-block h-[1em] w-[2px] align-middle animate-pulse bg-white/80" />
    </p>
  );
}

async function compressWallpaper(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSide = 1920;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.84, 0.74, 0.64, 0.54];
  let compressed = "";
  for (const quality of qualities) {
    compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length < 2_600_000) break;
  }
  return compressed;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });
}

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014)
  );
}
