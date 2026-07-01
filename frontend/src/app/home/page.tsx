"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent, WheelEvent } from "react";
import {
  authHeaders,
  clearAuthSession,
  ensureAuthorized,
  redirectToLogin,
  requireAuthToken,
  useAuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import { useAppSettings } from "@/lib/useAppSettings";

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

const siteInfo = [
  ["构建平台", "Local Dev"],
  ["博客版本", "Skyler v0.2.0"],
  ["技术栈", "Next.js + FastAPI + PostgreSQL"],
];

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);

export default function HomePage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");
  const currentUser = useAuthUser();
  const router = useRouter();
  const touchStartY = useRef<number | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const rippleId = useRef(0);

  const fetchPosts = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) {
      setIsLoadingPosts(false);
      return;
    }

    setIsLoadingPosts(true);
    setPostsError("");
    try {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) {
        throw new Error("文章列表加载失败");
      }
      const data: { posts: BlogPost[]; total: number } = await response.json();
      setPosts(data.posts);
      setTotalPosts(data.total);
    } catch (error) {
      setPosts([]);
      setTotalPosts(0);
      setPostsError(error instanceof Error ? error.message : "文章列表加载失败");
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

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const id = rippleId.current++;
    setRipples((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 900);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  const goWallpaper = useCallback(() => {
    router.push("/wallpaper");
  }, [router]);

  const handleTopWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY < -80 && window.scrollY <= 3) {
        goWallpaper();
      }
    },
    [goWallpaper],
  );

  const handleTopTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTopTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;
      if (startY != null && endY != null && startY - endY > 100 && window.scrollY <= 3) {
        goWallpaper();
      }
    },
    [goWallpaper],
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
    const latest = posts[0];

    return [
      ["文章", String(totalPosts)],
      ["分类", String(categories.length)],
      ["标签", String(tags.size)],
      ["总字数", wordCount.toLocaleString()],
      ["最新文章", latest ? latest.title : "暂无"],
      ["最近分类", latest?.category ?? "暂无"],
      ["最后活动", latest ? formatDate(latest.created_at) : "暂无"],
    ];
  }, [categories.length, posts, totalPosts]);

  const shellClass = useMemo(() => {
    const base = "home-shell min-h-screen";
    if (isNight) return `${base} home-night bg-black text-slate-100`;
    if (!showWallpaper) return `${base} bg-white text-slate-900`;
    return `${base} text-slate-900`;
  }, [isNight]);

  return (
    <main
      className={shellClass}
      style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}
      onWheel={handleTopWheel}
      onTouchStart={handleTopTouchStart}
      onTouchEnd={handleTopTouchEnd}
      onClick={handlePageClick}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 animate-[ripple_900ms_ease-out_forwards]"
          style={{ left: r.x, top: r.y, width: 8, height: 8 }}
        />
      ))}
      {showWallpaper && !isNight && (
        <div
          className="home-global-wallpaper"
          style={{ filter: "blur(12px) saturate(0.82)" }}
        />
      )}

      <SiteHeader
        isNight={isNight}
        showWallpaper={showWallpaper}
        user={currentUser}
        glassAlpha={glassAlpha}
        onGlassAlphaChange={setGlassAlpha}
        onToggleNight={toggleNight}
        onToggleWallpaper={toggleWallpaper}
        onLogout={logout}
      />

      <section
        className="home-content-panel relative z-10 px-[80px] pb-16 mt-[380px] pt-8"
      >
        <div className="home-dashboard-grid mx-auto grid max-w-[1700px] gap-5 xl:grid-cols-[1fr_3fr_1fr]">
          <aside className="home-static-column space-y-5 xl:self-start">
            <ProfileCard />
            <NoticeCard />
          </aside>

          <section data-home-scroll-column className="home-scroll-column space-y-5">
            <LatestPosts posts={posts} isLoading={isLoadingPosts} error={postsError} categories={categories} />
          </section>

          <aside className="home-static-column space-y-5 xl:self-start">
            <CalendarCard />
            <StatsCard stats={homeStats} />
          </aside>
        </div>
      </section>

      <footer className="relative z-10 mt-8 pb-6 text-center text-sm text-slate-500">
        {siteInfo.map(([label, value], i) => (
          <span key={label}>
            {label}：{value}
            {i < siteInfo.length - 1 && <span className="mx-4">·</span>}
          </span>
        ))}
      </footer>
    </main>
  );
}

function LatestPosts({
  posts,
  isLoading,
  error,
  categories,
}: {
  posts: BlogPost[];
  isLoading: boolean;
  error: string;
  categories: Array<{ name: string; count: number }>;
}) {
  const tags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => post.tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [posts]);

  return (
    <section className="space-y-5">
      <div className="home-card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="home-section-title">最新文章</h2>
          <Link href="/articles" className="home-pill-button">查看全部</Link>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">分类：</span>
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/articles?category=${encodeURIComponent(cat.name)}`}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100"
              >
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600">标签：</span>
            {tags.map(([tag, count]) => (
              <Link
                key={tag}
                href={`/articles?tag=${encodeURIComponent(tag)}`}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-600"
              >
                {tag} ({count})
              </Link>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="home-card p-6 text-sm font-semibold text-slate-700">正在加载文章...</div>
      )}
      {!isLoading && error && (
        <div className="home-card p-6 text-sm leading-7 text-slate-700">
          {error}。请确认后端服务正在运行。
        </div>
      )}
      {!isLoading && !error && posts.length === 0 && (
        <div className="home-card p-6 text-sm leading-7 text-slate-700">
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
      <p className="mt-4 text-sm text-slate-700">Hello, I am Skyler.</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {["Github", "Mail", "QQ"].map((item) => (
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
      <p className="mt-4 text-sm leading-7 text-slate-700">
        欢迎来到我的博客！页面骨架已拆分为首页、文章、照片墙、友链和留言，后续可以继续细化权限、详情页和后台管理。
      </p>
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
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
          <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">
            最新
          </span>
          <span>{formatDate(post.created_at)}</span>
          <span>{post.category}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-800">{post.summary}</p>
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
    <div className="home-card p-4">
      <h2 className="home-section-title">站点统计</h2>
      <div className="mt-3 space-y-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-slate-700">{label}</span>
            <strong className="text-sm text-slate-900 truncate max-w-[120px]">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarCard() {
  return (
    <div className="home-card p-4">
      <div className="flex items-center justify-between">
        <button type="button">‹</button>
        <h2 className="text-base font-bold">2026年6月</h2>
        <button type="button">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-700">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {calendarDays.map((day) => (
          <span
            key={day}
            className={`rounded py-1 ${day === 30 ? "border border-emerald-400 text-emerald-600 rounded-lg" : ""}`}
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
