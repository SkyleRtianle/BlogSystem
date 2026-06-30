"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent, WheelEvent } from "react";

type HomeMode = "wallpaper" | "night";

type BlogPost = {
  id: number;
  title: string;
  content: string;
  category: string;
  summary: string;
  tags: string[];
  keyword_matches: string[];
  created_at: string;
  updated_at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

const navItems = [
  { label: "主页", href: "/home" },
  { label: "文章", href: "/articles" },
  { label: "照片墙", href: "/photos" },
  { label: "友链", href: "/links" },
  { label: "留言", href: "/messages" },
  { label: "我的", href: "/home" },
  { label: "关于", href: "/home" },
];

const modeItems: Array<{ key: HomeMode; label: string }> = [
  { key: "wallpaper", label: "壁纸" },
  { key: "night", label: "夜间" },
];

const siteInfo = [
  ["构建平台", "Local Dev"],
  ["博客版本", "Skyler v0.2.0"],
  ["文章许可", "CC BY-NC-SA 4.0"],
];

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);

export default function HomePage() {
  const [mode, setMode] = useState<HomeMode>("wallpaper");
  const [wallpaperEntered, setWallpaperEntered] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const touchStartY = useRef<number | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts`);
      if (!response.ok) {
        throw new Error("文章列表加载失败");
      }
      const data: { posts: BlogPost[]; total: number } = await response.json();
      setPosts(data.posts);
      setTotalPosts(data.total);
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchPosts]);

  const selectMode = useCallback((nextMode: HomeMode) => {
    setMode(nextMode);
    setWallpaperEntered(false);
  }, []);

  const enterWallpaperContent = useCallback(() => {
    if (mode === "wallpaper") {
      setWallpaperEntered(true);
    }
  }, [mode]);

  const showWallpaperStage = useCallback(() => {
    setMode("wallpaper");
    setWallpaperEntered(false);
  }, []);

  const handleWallpaperWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY > 18) {
        enterWallpaperContent();
      }
    },
    [enterWallpaperContent],
  );

  const handleContentWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY < -60 && window.scrollY <= 20) {
        showWallpaperStage();
      }
    },
    [showWallpaperStage],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;

      if (startY == null || endY == null) return;
      if (endY - startY > 42) {
        enterWallpaperContent();
      }
    },
    [enterWallpaperContent],
  );

  const handleContentTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;

      if (startY == null || endY == null) return;
      if (startY - endY > 42 && window.scrollY <= 20) {
        showWallpaperStage();
      }
    },
    [showWallpaperStage],
  );

  const categories = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.category] = (acc[post.category] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [posts]);

  const homeStats = useMemo(() => {
    const tags = new Set(posts.flatMap((post) => post.tags));
    const wordCount = posts.reduce((sum, post) => sum + post.content.length, 0);

    return [
      ["文章", String(totalPosts)],
      ["分类", String(categories.length)],
      ["标签", String(tags.size)],
      ["总字数", wordCount.toLocaleString()],
      ["运行时长", "541 天"],
      ["最后活动", posts[0] ? formatDate(posts[0].created_at) : "暂无"],
    ];
  }, [categories.length, posts, totalPosts]);

  const hasWallpaper = mode === "wallpaper";
  const showHero = mode === "wallpaper" && !wallpaperEntered;

  const shellClass = useMemo(() => {
    const base = "home-shell min-h-screen";
    if (mode === "night") return `${base} home-night bg-slate-950 text-slate-100`;
    return `${base} text-slate-900`;
  }, [mode]);

  return (
    <main className={shellClass}>
      {hasWallpaper && (
        <>
          <div className="home-global-wallpaper" />
          <div className="home-hero-veil" />
        </>
      )}

      <SiteHeader mode={mode} onSelectMode={selectMode} />

      {mode === "wallpaper" && (
        <section
          onWheel={handleWallpaperWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`home-wallpaper-stage relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-6 text-center ${
            wallpaperEntered ? "home-wallpaper-stage-exit pointer-events-none" : ""
          }`}
        >
          <div className="drop-shadow-[0_10px_24px_rgba(15,23,42,0.38)]">
            <h1 className="text-5xl font-bold text-white sm:text-7xl">Skyler Blog</h1>
            <p className="mt-5 text-xl font-medium text-white/92 sm:text-2xl">
              From every quiet day, I write and shine.
            </p>
            <button
              type="button"
              onClick={enterWallpaperContent}
              className="mt-20 text-5xl font-light text-white/90 transition hover:translate-y-1"
              aria-label="进入内容"
            >
              ⌄
            </button>
            <p className="mt-3 text-sm font-medium text-white/75">向下滑动进入主页</p>
          </div>
        </section>
      )}

      <section
        onWheel={handleContentWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleContentTouchEnd}
        className={`relative z-10 px-4 pb-16 sm:px-6 ${
          showHero ? "home-content-after-wallpaper pointer-events-none opacity-0" : "pt-6"
        } ${mode === "wallpaper" && wallpaperEntered ? "home-content-enter" : ""}`}
      >
        <div className="mx-auto grid max-w-[1700px] gap-5 xl:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)_minmax(240px,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <ProfileCard />
            <NoticeCard />
            <CategoryCard categories={categories} />
          </aside>

          <section className="space-y-5">
            <HomeDashboard posts={posts} isLoading={isLoadingPosts} totalPosts={totalPosts} />
            <LatestPosts posts={posts} isLoading={isLoadingPosts} />
          </section>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <CalendarCard />
            <StatsCard stats={homeStats} />
            <SiteInfoCard />
          </aside>
        </div>
      </section>
    </main>
  );
}

function SiteHeader({
  mode,
  onSelectMode,
}: {
  mode: HomeMode;
  onSelectMode: (nextMode: HomeMode) => void;
}) {
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
            <Link key={item.label} href={item.href} className="transition hover:text-emerald-500">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/articles"
            className="hidden h-11 items-center rounded-xl bg-slate-100/70 px-4 text-sm font-semibold text-slate-500 transition hover:text-emerald-500 xl:flex"
          >
            搜索文章
          </Link>
          <div className="hidden rounded-xl bg-white/30 p-1 shadow-inner md:flex">
            {modeItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectMode(item.key)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  mode === item.key
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white/55"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}

function HomeDashboard({
  posts,
  isLoading,
  totalPosts,
}: {
  posts: BlogPost[];
  isLoading: boolean;
  totalPosts: number;
}) {
  const latest = posts[0];

  return (
    <section className="home-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-emerald-500">站点概览</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-900">
            记录文章、照片、友链与留言的个人博客空间
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            首页用于展示博客状态、最新内容和站点信息；文章发布、检索和管理已移动到文章页面。
          </p>
        </div>
        <Link href="/articles" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600">
          去写文章
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          ["文章总数", String(totalPosts)],
          ["最新文章", latest ? latest.title : isLoading ? "加载中" : "暂无文章"],
          ["最近分类", latest?.category ?? "暂无"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/55 p-4">
            <p className="text-xs font-bold text-slate-400">{label}</p>
            <strong className="mt-2 block truncate text-lg text-slate-900">{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function LatestPosts({ posts, isLoading }: { posts: BlogPost[]; isLoading: boolean }) {
  return (
    <section className="space-y-5">
      <div className="home-card flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 className="home-section-title">最新文章</h2>
        <Link href="/articles" className="home-pill-button">查看全部</Link>
      </div>
      {isLoading && (
        <div className="home-card p-6 text-sm font-semibold text-slate-500">正在加载文章...</div>
      )}
      {!isLoading && posts.length === 0 && (
        <div className="home-card p-6 text-sm leading-7 text-slate-500">
          还没有文章。进入文章页面后，可以发布第一篇 Markdown 博客。
        </div>
      )}
      {posts.slice(0, 4).map((post, index) => (
        <PostCard key={post.id} post={post} index={index} />
      ))}
    </section>
  );
}

function ProfileCard() {
  return (
    <div className="home-card p-5 text-center">
      <div className="mx-auto grid aspect-square w-full max-w-[190px] place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 via-white to-sky-100 text-6xl font-bold text-emerald-600 shadow-inner">
        S
      </div>
      <h2 className="mt-5 text-2xl font-bold">Skyler</h2>
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-emerald-400" />
      <p className="mt-4 text-sm text-slate-500">Hello, I am Skyler.</p>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {["Git", "Hub", "Mail", "RSS"].map((item) => (
          <button key={item} type="button" className="home-soft-button">
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoticeCard() {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">公告</h2>
      <p className="mt-4 text-sm leading-7 text-slate-500">
        欢迎来到我的博客！页面骨架已拆分为首页、文章、照片墙、友链和留言，后续可以继续细化权限、详情页和后台管理。
      </p>
    </div>
  );
}

function CategoryCard({ categories }: { categories: Array<{ name: string; count: number }> }) {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">分类</h2>
      <div className="mt-4 space-y-3 text-sm">
        {(categories.length ? categories : [{ name: "未分类", count: 0 }]).map((category) => (
          <div key={category.name} className="flex items-center justify-between">
            <span>{category.name}</span>
            <strong className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600">{category.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <article className="home-card grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
      <div>
        <h2 className="border-l-4 border-emerald-400 pl-4 text-2xl font-bold leading-tight">
          {post.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
          <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">
            最新
          </span>
          <span>{formatDate(post.created_at)}</span>
          <span>{post.category}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">{post.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div
        className="min-h-40 rounded-2xl bg-cover bg-center shadow-inner"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)), url('/images/home-background.png')`,
          backgroundPosition: index % 2 === 0 ? "center" : "70% center",
        }}
      />
    </article>
  );
}

function StatsCard({ stats }: { stats: string[][] }) {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">站点统计</h2>
      <div className="mt-5 space-y-4">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <strong className="text-base text-slate-900">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SiteInfoCard() {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">站点信息</h2>
      <div className="mt-5 space-y-3">
        {siteInfo.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-white/45 px-3 py-2 text-sm">
            <span className="text-slate-500">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarCard() {
  return (
    <div className="home-card p-5">
      <div className="flex items-center justify-between">
        <button type="button">‹</button>
        <h2 className="text-xl font-bold">2026年6月</h2>
        <button type="button">›</button>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-sm text-slate-500">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {calendarDays.map((day) => (
          <span
            key={day}
            className={`rounded-lg py-1.5 ${day === 30 ? "border border-emerald-400 text-emerald-600" : ""}`}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
