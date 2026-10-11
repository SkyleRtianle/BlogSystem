"use client";

import Link from "next/link";
import { useMemo, useCallback, useEffect, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import MusicPlayer from "@/components/MusicPlayer";
import { useAppSettings } from "@/lib/useAppSettings";
import { useAudioState } from "@/lib/audioState";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";


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
          <MusicPlayer hrefPrefix={`/${username}`} dataReady={dataReady} />
        </div>
        <ShowcaseNoticeBar dataReady={dataReady} />
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

function ShowcaseNoticeBar({ dataReady }: { dataReady: boolean }) {
  const { isPlaying, lyrics, lyricIndex } = useAudioState();
  const signature = "欢迎来到我的博客！";
  const currentLyric = isPlaying && lyrics && lyricIndex >= 0
    ? lyrics[lyricIndex]?.text ?? ""
    : "";

  return (
    <div className={`showcase-notice-bar ${dataReady ? "card-fly-in" : "card-init-hidden"}`}>
      <span>······</span>
      <strong>
        {currentLyric ? (
          <TypewriterText text={currentLyric} loop={false} />
        ) : (
          <TypewriterText text={signature} />
        )}
      </strong>
      <span className={isPlaying ? "showcase-music-note-pulse" : ""} aria-hidden="true">♫</span>
    </div>
  );
}

function TypewriterText({ text, loop = true }: { text: string; loop?: boolean }) {
  const characters = useMemo(() => Array.from(text || "欢迎来到我的博客！"), [text]);
  const [count, setCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const atEnd = count >= characters.length;
    const atStart = count <= 0;

    if (!loop && atEnd) return;

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
  }, [characters.length, count, isDeleting, loop]);

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
  const activePhoto = recentPhotos.length > 0 ? recentPhotos[photoIndex % recentPhotos.length] : null;

  useEffect(() => {
    if (recentPhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setPhotoIndex((current) => (current + 1) % recentPhotos.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [recentPhotos.length]);

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
          {!isLoading && !error && recentPosts.length > 0 && (
            <div className="showcase-article-board">
              {recentPosts.map((post, index) => (
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
  return `linear-gradient(135deg, ${accents[index % accents.length]}), var(--home-wallpaper-image, url('/images/home-background.png'))`;
}

function buildPhotoCover(photo: Photo) {
  const imageUrl = photo.image_url.startsWith("data:")
    ? photo.image_url
    : `${API_BASE_URL}/photos/file/${photo.image_url}`;
  return `linear-gradient(180deg, rgb(15 23 42 / 0), rgb(15 23 42 / 0.42)), url("${imageUrl}")`;
}

function PostCard({ post, index, username, dataReady = true }: { post: BlogPost; index: number; username: string; dataReady?: boolean }) {
  const imageHeights = [150, 210, 176, 238, 188, 260];
  const imageHeight = imageHeights[index % imageHeights.length];
  const coverBg = post.cover_url
    ? `url("${post.cover_url}")`
    : `linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)), var(--home-wallpaper-image, url('/images/home-background.png'))`;

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
