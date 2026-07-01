"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchEvent, WheelEvent } from "react";
import { requireAuthToken, redirectToLogin } from "@/lib/auth";

const TAGLINES = [
  "From every quiet day, I write and shine.",
  "记录每一个安静的日子，书写与发光。",
  "Share stories, capture moments, connect hearts.",
];

export default function WallpaperPage() {
  const router = useRouter();
  const touchStartY = useRef<number | null>(null);

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

  return (
    <main className="home-shell h-screen overflow-hidden">
      <div className="home-global-wallpaper" style={{ filter: "saturate(0.82)" }} />
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
        setIsDeleting(false);
        setTextIndex((textIndex + 1) % texts.length);
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
