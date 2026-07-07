"use client";

import Link from "next/link";
import { useMemo, useCallback, useEffect, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import { useAppSettings } from "@/lib/useAppSettings";
import { useParams } from "next/navigation";

type BlogPost = {
  id: number;
  title: string;
  content: string;
  category: string;
  cover_url: string;
  summary: string;
  tags: string[];
  keyword_matches: string[];
  created_at: string;
  updated_at: string;
};

type Photo = {
  id: number;
  title: string;
  image_url: string;
  description: string;
  created_at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

const DEFAULT_NOTICE = "欢迎来到我的博客！";

const siteInfo = [
  ["构建平台", "Local Dev"],
  ["博客版本", "Skyler v0.2.0"],
  ["技术栈", "Next.js + FastAPI + PostgreSQL"],
];

export default function PublicHomePage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    setPostsError("");
    try {
      const response = await fetch(`${API_BASE_URL}/public/${username}/posts`);
      if (!response.ok) throw new Error("文章列表加载失败");
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
  }, [username]);

  const fetchPhotos = useCallback(async () => {
    setIsLoadingPhotos(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public/${username}/photos`);
      if (!response.ok) throw new Error("照片列表加载失败");
      const data: { photos: Photo[]; total: number } = await response.json();
      setPhotos(data.photos);
    } catch {
      setPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [username]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts();
      void fetchPhotos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPhotos, fetchPosts]);

  useEffect(() => {
    if (!isLoadingPosts) {
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDataReady(true);
        });
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [isLoadingPosts]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelector(".page-fade-in")?.classList.add("page-fade-in-ready");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

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

  const showcaseStats = useMemo(() => {
    const tags = new Set(posts.flatMap((post) => post.tags));
    return [
      ["文章", String(totalPosts)],
      ["分类", String(categories.length)],
      ["标签", String(tags.size)],
    ];
  }, [categories.length, posts, totalPosts]);

  const shellClass = useMemo(() => {
    const base = "home-shell min-h-screen";
    if (isNight) return `${base} home-night bg-black text-slate-100`;
    if (!showWallpaper) return `${base} bg-white text-slate-900`;
    return `${base} text-slate-900`;
  }, [isNight, showWallpaper]);

  return (
    <main className={shellClass} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}

      <PublicHeader active="主页" username={username} isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} />

      <section className="home-showcase page-fade-in relative z-10 mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="showcase-search-spacer" aria-hidden="true" />
        <div className="home-showcase-hero">
          <ShowcaseProfileCard
            displayName={username}
            intro={`${username}'s Blog`}
            avatarUrl=""
            initial={username.slice(0, 1).toUpperCase()}
            stats={showcaseStats}
            dataReady={dataReady}
          />
          <ShowcaseMusicCard dataReady={dataReady} />
        </div>
        <ShowcaseNoticeBar notice={DEFAULT_NOTICE} dataReady={dataReady} />
        <RecentPostsCarousel posts={posts} photos={photos} isLoading={isLoadingPosts} isLoadingPhotos={isLoadingPhotos} error={postsError} dataReady={dataReady} hrefPrefix={`/${username}`} />
      </section>

      <footer className="relative z-10 mt-8 pb-6 text-center text-sm text-slate-500 xl:hidden">
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
  posts, isLoading, error, categories, username, dataReady,
}: {
  posts: BlogPost[];
  isLoading: boolean;
  error: string;
  categories: Array<{ name: string; count: number }>;
  username: string;
  dataReady: boolean;
}) {
  const tags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((post) => post.tags.forEach((tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [posts]);

  return (
    <section className="space-y-5">
      <div className={`home-card space-y-4 p-4 ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: "160ms" } : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="home-section-title">最新文章</h2>
          <Link href={`/${username}/articles`} className="home-pill-button">查看全部</Link>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600">分类：</span>
            {categories.map((cat) => (
              <Link key={cat.name} href={`/${username}/articles?category=${encodeURIComponent(cat.name)}`}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100">
                {cat.name} ({cat.count})
              </Link>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600">标签：</span>
            {tags.map(([tag, count]) => (
              <Link key={tag} href={`/${username}/articles?tag=${encodeURIComponent(tag)}`}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-600">
                {tag} ({count})
              </Link>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="home-skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="home-skeleton-card">
              <div className="home-skeleton-cover" style={{ height: `${[150, 210, 176, 238, 188, 260][i % 6]}px` }} />
              <div className="home-skeleton-lines">
                <div className="home-skeleton-line" />
                <div className="home-skeleton-line" />
                <div className="home-skeleton-line" />
              </div>
              <div className="home-skeleton-tags">
                <div className="home-skeleton-tag" />
                <div className="home-skeleton-tag" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && error && <div className="home-card p-6 text-sm leading-7 text-slate-700">{error}。请确认后端服务正在运行。</div>}
      {!isLoading && !error && posts.length === 0 && <div className="home-card p-6 text-sm leading-7 text-slate-700">还没有文章。</div>}
      {posts.length > 0 && (
        <div className="home-masonry-feed">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} username={username} dataReady={dataReady} />
          ))}
        </div>
      )}
    </section>
  );
}

function ShowcaseProfileCard({
  displayName,
  intro,
  avatarUrl,
  initial,
  stats,
  dataReady,
}: {
  displayName: string;
  intro: string;
  avatarUrl: string;
  initial: string;
  stats: string[][];
  dataReady: boolean;
}) {
  return (
    <section className={`showcase-profile-card home-card ${dataReady ? "card-fly-in" : "card-init-hidden"}`}>
      <div className="showcase-profile-main">
        <div className="showcase-avatar">
          {avatarUrl ? <span style={{ backgroundImage: `url("${avatarUrl}")` }} /> : <strong>{initial}</strong>}
        </div>
        <div>
          <h1>{displayName}</h1>
          <p>{intro}</p>
        </div>
      </div>
      <div className="showcase-profile-bottom">
        <div className="showcase-stats">
          {stats.map(([label, value]) => (
            <span key={label}>
              <strong>{value}</strong>
              <small>{label}</small>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseMusicCard({ dataReady }: { dataReady: boolean }) {
  return (
    <section className={`showcase-music-card home-card ${dataReady ? "card-fly-in" : "card-init-hidden"}`}>
      <div className="showcase-music-disc">
        <span />
      </div>
      <div className="showcase-music-copy">
        <small>Cloud Music</small>
        <strong>雨爱</strong>
        <span>杨丞琳</span>
      </div>
      <div className="showcase-music-progress">
        <span>00:00</span>
        <i><b /></i>
        <span>04:20</span>
      </div>
      <div className="showcase-music-controls" aria-hidden="true">
        <span>‹</span>
        <strong>▶</strong>
        <span>›</span>
      </div>
    </section>
  );
}

function ShowcaseNoticeBar({ notice, dataReady }: { notice: string; dataReady: boolean }) {
  const signature = notice || "欢迎来到我的博客！";
  return (
    <div className={`showcase-notice-bar ${dataReady ? "card-fly-in" : "card-init-hidden"}`}>
      <span>······</span>
      <strong><TypewriterText text={signature} /></strong>
      <span aria-hidden="true">♫</span>
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const characters = useMemo(() => Array.from(text || "欢迎来到我的博客！"), [text]);
  const [count, setCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const atEnd = count >= characters.length;
    const atStart = count <= 0;
    const delay = atEnd && !isDeleting ? 1100 : atStart && isDeleting ? 420 : isDeleting ? 36 : 82;

    const timer = window.setTimeout(() => {
      if (!isDeleting && atEnd) {
        setIsDeleting(true);
        return;
      }
      if (isDeleting && atStart) {
        setIsDeleting(false);
        return;
      }
      setCount((current) => current + (isDeleting ? -1 : 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [characters.length, count, isDeleting]);

  useEffect(() => {
    setCount(0);
    setIsDeleting(false);
  }, [text]);

  return (
    <span className="showcase-typewriter">
      {characters.slice(0, count).join("")}
      <i aria-hidden="true" />
    </span>
  );
}

function RecentPostsCarousel({
  posts,
  photos,
  isLoading,
  isLoadingPhotos,
  error,
  dataReady,
  hrefPrefix,
}: {
  posts: BlogPost[];
  photos: Photo[];
  isLoading: boolean;
  isLoadingPhotos: boolean;
  error: string;
  dataReady: boolean;
  hrefPrefix: string;
}) {
  const recentPosts = posts.slice(0, 4);
  const recentPhotos = photos.slice(0, 4);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [postOffset, setPostOffset] = useState(0);
  const activePhoto = recentPhotos.length > 0 ? recentPhotos[photoIndex % recentPhotos.length] : null;
  const visiblePosts = recentPosts.length > 0
    ? Array.from({ length: Math.min(4, recentPosts.length) }, (_, index) => recentPosts[(postOffset + index) % recentPosts.length])
    : [];

  useEffect(() => {
    if (recentPhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setPhotoIndex((current) => (current + 1) % recentPhotos.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [recentPhotos.length]);

  useEffect(() => {
    if (recentPosts.length <= 1) return;
    const timer = window.setInterval(() => {
      setPostOffset((current) => (current + 1) % recentPosts.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [recentPosts.length]);

  return (
    <section className={`showcase-post-carousel showcase-media-refresh ${dataReady ? "card-fly-in" : "card-init-hidden"}`} aria-label="最近内容轮播">
      <div className="showcase-carousel-head">
        <h2>最近动态</h2>
        <Link href={`${hrefPrefix}/articles`} className="home-pill-button">查看全部</Link>
      </div>
      <div className="showcase-media-grid">
        <div className="showcase-photo-refresh-panel">
          <div className="showcase-panel-title">
            <strong>相册照片</strong>
            <Link href={`${hrefPrefix}/photos`}>刷新中</Link>
          </div>
          {isLoadingPhotos && <div className="showcase-photo-skeleton" />}
          {!isLoadingPhotos && recentPhotos.length === 0 && <div className="showcase-empty-state home-card">暂无照片。</div>}
          {!isLoadingPhotos && activePhoto && (
            <Link
              key={activePhoto.id}
              href={`${hrefPrefix}/photos`}
              className="showcase-photo-feature"
              style={{ backgroundImage: buildPhotoCover(activePhoto) }}
            >
              <span>{activePhoto.title || "相册照片"}</span>
            </Link>
          )}
        </div>

        <div className="showcase-article-refresh-panel">
          {isLoading && (
            <div className="showcase-carousel-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="showcase-post-skeleton" />
              ))}
            </div>
          )}
          {!isLoading && error && <div className="home-card showcase-empty-state">{error}。请确认后端服务正在运行。</div>}
          {!isLoading && !error && posts.length === 0 && <div className="home-card showcase-empty-state">还没有文章。</div>}
          {!isLoading && !error && visiblePosts.length > 0 && (
            <div className="showcase-article-board" key={postOffset}>
              {visiblePosts.map((post, index) => (
                <Link
                  key={`${post.id}-${index}`}
                  href={`${hrefPrefix}/articles/${post.id}`}
                  className={`showcase-board-post ${index === 0 ? "showcase-board-post-main" : ""}`}
                >
                  <article style={{ backgroundImage: buildPostCover(post, index) }}>
                    <div>
                      <span>{post.category}</span>
                      <h3>{post.title}</h3>
                      {index === 0 && <p>{post.summary}</p>}
                      <small>{formatDate(post.created_at)}</small>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function buildPostCover(post: BlogPost, index: number) {
  if (post.cover_url) {
    return `linear-gradient(180deg, rgb(15 23 42 / 0.02), rgb(15 23 42 / 0.66)), url("${post.cover_url}")`;
  }
  const accents = [
    "rgba(14,165,233,.34), rgba(16,185,129,.22)",
    "rgba(236,72,153,.30), rgba(14,165,233,.24)",
    "rgba(99,102,241,.30), rgba(250,204,21,.22)",
  ];
  return `linear-gradient(135deg, ${accents[index % accents.length]}), url('/images/home-background.png')`;
}

function buildPhotoCover(photo: Photo) {
  const imageUrl = photo.image_url.startsWith("data:")
    ? photo.image_url
    : `${API_BASE_URL}/photos/file/${photo.image_url}`;
  return `linear-gradient(180deg, rgb(15 23 42 / 0), rgb(15 23 42 / 0.42)), url("${imageUrl}")`;
}

function PublicProfileCard({ username, index = 0 }: { username: string; index?: number }) {
  const initial = username.slice(0, 1).toUpperCase();
  return (
    <div className="home-card card-fly-in p-4 text-center" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="profile-avatar-frame mx-auto">
        <span>{initial}</span>
      </div>
      <h2 className="mt-4 truncate text-xl font-bold">{username}</h2>
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-emerald-400" />
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-700">{username}&apos;s Blog</p>
    </div>
  );
}

function NoticeCard({ index = 0 }: { index?: number }) {
  return (
    <div className="home-card card-fly-in p-5" style={{ animationDelay: `${index * 80}ms` }}>
      <h2 className="home-section-title">公告</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{DEFAULT_NOTICE}</p>
    </div>
  );
}

function PostCard({ post, index, username, dataReady = true }: { post: BlogPost; index: number; username: string; dataReady?: boolean }) {
  const imageHeights = [150, 210, 176, 238, 188, 260];
  const imageHeight = imageHeights[index % imageHeights.length];
  const coverBg = post.cover_url
    ? `url("${post.cover_url}")`
    : `linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)), url('/images/home-background.png')`;

  return (
    <Link href={`/${username}/articles/${post.id}`} className={`home-masonry-card block no-underline ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: `${240 + index * 70}ms` } : undefined}>
      <article className="home-card home-clickable-card overflow-hidden">
        <div className="bg-cover bg-center shadow-inner" style={{
          height: imageHeight,
          backgroundImage: coverBg,
          backgroundPosition: index % 2 === 0 ? "center" : "70% center",
        }} />
        <div className="p-5">
          <h2 className="border-l-4 border-emerald-400 pl-4 text-2xl font-bold leading-tight">{post.title}</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
            <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">最新</span>
            <span>{formatDate(post.created_at)}</span>
            <span>{post.category}</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-800">{post.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">#{tag}</span>
            ))}
          </div>
        </div>
      </article>
    </Link>
  );
}

function StatsCard({ stats, index = 0, dataReady = true }: { stats: string[][]; index?: number; dataReady?: boolean }) {
  return (
    <div className={`home-card p-4 ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: `${index * 80}ms` } : undefined}>
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

function CalendarCard({ index = 0, dataReady = true }: { index?: number; dataReady?: boolean }) {
  const today = useMemo(() => stripTime(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const calendarCells = useMemo(() => buildCalendarCells(visibleMonth), [visibleMonth]);
  const monthTitle = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(visibleMonth);
  const selectedLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(selectedDate);

  return (
    <div className={`home-card p-4 ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: `${index * 80}ms` } : undefined}>
      <div className="flex items-center justify-between">
        <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((c) => addMonths(c, -1))} aria-label="上个月">‹</button>
        <button type="button" className="calendar-title-button" onClick={() => { setVisibleMonth(startOfMonth(today)); setSelectedDate(today); }} title="回到今天">{monthTitle}</button>
        <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((c) => addMonths(c, 1))} aria-label="下个月">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-700">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
        {calendarCells.map((date) => (
          <button key={date.toISOString()} type="button"
            className={["calendar-day-button", isSameMonth(date, visibleMonth) ? "" : "calendar-day-muted", isSameDate(date, today) ? "calendar-day-today" : "", isSameDate(date, selectedDate) ? "calendar-day-selected" : ""].filter(Boolean).join(" ")}
            onClick={() => setSelectedDate(date)} aria-pressed={isSameDate(date, selectedDate)}
            aria-label={new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date)}>
            {date.getDate()}
          </button>
        ))}
      </div>
      <div className="calendar-selected-note" suppressHydrationWarning>{selectedLabel}</div>
    </div>
  );
}

function stripTime(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function buildCalendarCells(month: Date) {
  const firstDay = startOfMonth(month);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
}
function isSameMonth(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function isSameDate(a: Date, b: Date) { return isSameMonth(a, b) && a.getDate() === b.getDate(); }

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
