"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";

const navItems = [
  { label: "主页", href: "/home" },
  { label: "文章", href: "/articles" },
  { label: "照片墙", href: "/photos" },
  { label: "友链", href: "/links" },
];

let lastNavIndex: number | null = null;

type Props = {
  active?: string;
  isNight: boolean;
  showWallpaper: boolean;
  glassAlpha: number;
  user: AuthUser | null;
  onGlassAlphaChange: (value: number) => void;
  onToggleNight: () => void;
  onToggleWallpaper: () => void;
  onLogout: () => void;
};

export default function SiteHeader({
  active,
  isNight,
  showWallpaper,
  glassAlpha,
  onGlassAlphaChange,
  onToggleNight,
  onToggleWallpaper,
  onLogout,
}: Props) {
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.label === (active ?? "主页")));
  const [sliderIndex, setSliderIndex] = useState(() => lastNavIndex ?? activeIndex);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSliderIndex(activeIndex);
      lastNavIndex = activeIndex;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex]);

  return (
    <header className="sticky top-0 z-40 mx-auto max-w-[1720px] px-4 pt-3 sm:px-6">
      <nav className="home-nav flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/home" className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-600">
              S
            </span>
            <span className="truncate text-lg font-bold">Skyler Blog</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="site-logout-capsule"
            aria-label="退出登录"
          >
            退出
          </button>
        </div>

        <div
          className="nav-slider-group hidden text-sm font-semibold lg:flex"
          style={{ "--nav-active-index": sliderIndex } as React.CSSProperties}
        >
          <span className="nav-slider-thumb" aria-hidden="true" />
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-slider-link ${
                active === item.label ? "text-emerald-500" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`theme-mode-switch hidden md:grid ${isNight ? "theme-mode-switch-night" : ""}`}
            role="group"
            aria-label="白天夜间模式"
          >
            <span className="theme-mode-thumb" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                if (isNight) {
                  onToggleNight();
                  return;
                }
                onToggleWallpaper();
              }}
              aria-label={isNight ? "切换白天模式" : showWallpaper ? "切换白色背景" : "切换壁纸背景"}
              aria-pressed={!isNight}
              title={isNight ? "白天" : showWallpaper ? "白色背景" : "壁纸背景"}
              className="theme-mode-option"
            >
              ☀
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isNight) onToggleNight();
              }}
              aria-label="切换夜间模式"
              aria-pressed={isNight}
              title="夜间"
              className="theme-mode-option"
            >
              ☾
            </button>
          </div>
          <div className="glass-control hidden items-center gap-2 md:flex">
            <span className="glass-control-label">玻璃度</span>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.01"
              value={glassAlpha}
              onChange={(e) => onGlassAlphaChange(parseFloat(e.target.value))}
              style={{ "--glass-progress": `${((glassAlpha - 0.1) / 0.85) * 100}%` } as React.CSSProperties}
              className="glass-slider"
            />
            <span className="glass-control-value">{Math.round(glassAlpha * 100)}%</span>
          </div>
        </div>
      </nav>
    </header>
  );
}
