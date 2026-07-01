"use client";

import Link from "next/link";
import type { AuthUser } from "@/lib/auth";

const navItems = [
  { label: "主页", href: "/home" },
  { label: "文章", href: "/articles" },
  { label: "照片墙", href: "/photos" },
  { label: "友链", href: "/links" },
  { label: "留言", href: "/messages" },
  { label: "我的", href: "/home" },
];

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
  user,
  onGlassAlphaChange,
  onToggleNight,
  onToggleWallpaper,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-40 mx-auto max-w-[1720px] px-4 pt-3 sm:px-6">
      <nav className="home-nav flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/home" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-600">
            S
          </span>
          <span className="truncate text-lg font-bold">Skyler Blog</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-semibold lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`transition hover:text-emerald-500 ${
                active === item.label ? "text-emerald-500" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-800 sm:inline">
              {user.nickname || user.email}
            </span>
          )}
          <Link
            href="/articles"
            className="hidden h-11 items-center rounded-xl bg-slate-100/70 px-4 text-sm font-semibold text-slate-700 transition hover:text-emerald-500 xl:flex"
          >
            搜索文章
          </Link>
          <div className="hidden rounded-xl bg-white/30 p-1 shadow-inner md:flex">
            <button
              type="button"
              onClick={onToggleWallpaper}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                !showWallpaper
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-800 hover:bg-white/55"
              }`}
            >
              纯色
            </button>
            <button
              type="button"
              onClick={onToggleNight}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                isNight
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-800 hover:bg-white/55"
              }`}
            >
              夜间
            </button>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="text-xs font-semibold text-slate-600">玻璃度</span>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.01"
              value={glassAlpha}
              onChange={(e) => onGlassAlphaChange(parseFloat(e.target.value))}
              className="glass-slider"
            />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl bg-slate-100/70 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:text-emerald-500"
          >
            退出
          </button>
        </div>
      </nav>
    </header>
  );
}
