"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, TouchEvent, WheelEvent } from "react";
import {
  type AuthUser,
  authHeaders,
  clearAuthSession,
  ensureAuthorized,
  redirectToLogin,
  requireAuthToken,
  useAuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import MusicPlayer from "@/components/MusicPlayer";
import { useAppSettings } from "@/lib/useAppSettings";
import { useAudioState } from "@/lib/audioState";

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

type ProfileSettings = {
  avatarUrl: string;
  displayName: string;
  email: string;
  githubUrl: string;
  qqUrl: string;
  intro: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  avatarUrl: "",
  displayName: "Skyler",
  email: "",
  githubUrl: "",
  qqUrl: "",
  intro: "Hello, I am Skyler.",
};

const siteInfo = [
  ["构建平台", "Local Dev"],
  ["博客版本", "Skyler v0.2.0"],
  ["技术栈", "Next.js + FastAPI + PostgreSQL"],
];

export default function HomePage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const currentUser = useAuthUser();
  const router = useRouter();
  const touchStartY = useRef<number | null>(null);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const rippleId = useRef(0);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState("");

  const profileStorageKey = useMemo(() => {
    const identity = currentUser?.id ?? currentUser?.email ?? "guest";
    return `blogsystem.home.profile.${identity}`;
  }, [currentUser]);

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

  const fetchPhotos = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) {
      setIsLoadingPhotos(false);
      return;
    }

    setIsLoadingPhotos(true);
    try {
      const response = await fetch(`${API_BASE_URL}/photos`, {
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) throw new Error("照片列表加载失败");
      const data: { photos: Photo[]; total: number } = await response.json();
      setPhotos(data.photos);
    } catch {
      setPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const baseSettings = buildProfileSettings(currentUser);
      const savedSettings = loadProfileSettings(profileStorageKey, baseSettings);
      setProfileSettings(savedSettings);
      setProfileDraft(savedSettings);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentUser, profileStorageKey]);

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const id = rippleId.current++;
    setRipples((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 900);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  const openProfileEditor = useCallback(() => {
    setProfileDraft(profileSettings);
    setProfileEditorError("");
    setIsProfileEditorOpen(true);
  }, [profileSettings]);

  const closeProfileEditor = useCallback(() => {
    setIsProfileEditorOpen(false);
  }, []);

  const updateProfileDraft = useCallback((field: keyof ProfileSettings, value: string) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const updateProfileAvatar = useCallback(async (file: File | null) => {
    if (!file) return;
    setProfileEditorError("");

    try {
      const avatarUrl = await compressAvatarFile(file);
      setProfileDraft((current) => ({ ...current, avatarUrl }));
    } catch {
      setProfileEditorError("头像处理失败，请换一张图片再试。");
    }
  }, []);

  const saveProfileSettings = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextSettings = normalizeProfileSettings(profileDraft);
      try {
        window.localStorage.setItem(profileStorageKey, JSON.stringify(nextSettings));
        setProfileSettings(nextSettings);
        setIsProfileEditorOpen(false);
        setProfileEditorError("");
      } catch (error) {
        setProfileEditorError(
          isQuotaExceededError(error)
            ? "浏览器本地存储空间已满。请移除头像，或换一张更小的头像后再保存。"
            : "资料保存失败，请稍后再试。",
        );
      }
    },
    [profileDraft, profileStorageKey],
  );

  const goWallpaper = useCallback(() => {
    router.push("/wallpaper");
  }, [router]);

  const canReturnToWallpaper = useCallback(() => {
    const scrollColumn = document.querySelector<HTMLElement>("[data-home-scroll-column]");
    return window.scrollY <= 3 && (!scrollColumn || scrollColumn.scrollTop <= 3);
  }, []);

  const handleTopWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY < -110 && canReturnToWallpaper()) {
        goWallpaper();
      }
    },
    [canReturnToWallpaper, goWallpaper],
  );

  const handleTopTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTopTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const startY = touchStartY.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartY.current = null;
      if (startY != null && endY != null && startY - endY > 120 && canReturnToWallpaper()) {
        goWallpaper();
      }
    },
    [canReturnToWallpaper, goWallpaper],
  );

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

      <section className="home-showcase page-fade-in relative z-10 mx-auto w-full max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="showcase-search-spacer" aria-hidden="true" />
        <div className="home-showcase-hero">
          <ShowcaseProfileCard
            displayName={profileSettings.displayName || currentUser?.nickname || currentUser?.email?.split("@", 1)[0] || "Skyler"}
            intro={profileSettings.intro || DEFAULT_PROFILE_SETTINGS.intro}
            avatarUrl={profileSettings.avatarUrl}
            initial={(profileSettings.displayName || currentUser?.nickname || "S").slice(0, 1).toUpperCase()}
            stats={showcaseStats}
            links={[
              { label: "Github", icon: "github", href: profileSettings.githubUrl },
              { label: "邮箱", icon: "mail", href: profileSettings.email ? `mailto:${profileSettings.email}` : currentUser?.email ? `mailto:${currentUser.email}` : "" },
              { label: "QQ", icon: "qq", href: profileSettings.qqUrl },
            ]}
            onEdit={openProfileEditor}
            dataReady={dataReady}
          />
          <MusicPlayer hrefPrefix="" dataReady={dataReady} />
        </div>
        <ShowcaseNoticeBar dataReady={dataReady} />
        <RecentPostsCarousel posts={posts} photos={photos} isLoading={isLoadingPosts} isLoadingPhotos={isLoadingPhotos} error={postsError} dataReady={dataReady} hrefPrefix="" />
      </section>

      <footer className="relative z-10 mt-8 pb-6 text-center text-sm text-slate-500 xl:hidden">
        {siteInfo.map(([label, value], i) => (
          <span key={label}>
            {label}：{value}
            {i < siteInfo.length - 1 && <span className="mx-4">·</span>}
          </span>
        ))}
      </footer>

      {isProfileEditorOpen && (
        <ProfileEditor
          draft={profileDraft}
          error={profileEditorError}
          onChange={updateProfileDraft}
          onAvatarChange={updateProfileAvatar}
          onClose={closeProfileEditor}
          onSubmit={saveProfileSettings}
        />
      )}
    </main>
  );
}

function ShowcaseProfileCard({
  displayName,
  intro,
  avatarUrl,
  initial,
  stats,
  links,
  onEdit,
  dataReady,
}: {
  displayName: string;
  intro: string;
  avatarUrl: string;
  initial: string;
  stats: string[][];
  links: Array<{ label: string; icon: "github" | "mail" | "qq"; href: string }>;
  onEdit?: () => void;
  dataReady: boolean;
}) {
  return (
    <section
      className={`showcase-profile-card home-card ${dataReady ? "card-fly-in" : "card-init-hidden"}`}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (!onEdit) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
    >
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
        <div className="showcase-contact-row">
          {links.map((item) => (
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={(event) => event.stopPropagation()}
              >
                <ContactIcon name={item.icon} />
              </a>
            ) : (
              <span key={item.label} aria-label={`${item.label} 未设置`} title={`${item.label} 未设置`}>
                <ContactIcon name={item.icon} />
              </span>
            )
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
          {!isLoading && !error && posts.length === 0 && <div className="home-card showcase-empty-state">还没有文章。进入文章页面后，可以发布第一篇 Markdown 博客。</div>}
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

function ContactIcon({ name }: { name: "github" | "mail" | "qq" }) {
  if (name === "github") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.04 1.53 1.04.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03A9.56 9.56 0 0 1 12 7c.85 0 1.7.11 2.5.34 1.9-1.3 2.74-1.03 2.74-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.57c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
        />
      </svg>
    );
  }

  if (name === "mail") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 6h16v12H4z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="m4 7 8 6 8-6"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15.5 15.5 18 18M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
      />
    </svg>
  );
}

function ProfileEditor({
  draft,
  error,
  onChange,
  onAvatarChange,
  onClose,
  onSubmit,
}: {
  draft: ProfileSettings;
  error: string;
  onChange: (field: keyof ProfileSettings, value: string) => void;
  onAvatarChange: (file: File | null) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="profile-edit-backdrop" onClick={onClose}>
      <form className="profile-edit-panel" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">编辑个人卡片</h2>
            <p className="mt-1 text-sm text-slate-600">主页展示信息会按当前账号保存。</p>
          </div>
          <button type="button" className="home-square-button" onClick={onClose} aria-label="关闭编辑面板">
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="profile-avatar-editor sm:col-span-2">
            <div className="profile-avatar-frame profile-avatar-editor-preview">
              {draft.avatarUrl ? (
                <span
                  className="profile-avatar-image"
                  role="img"
                  aria-label="头像预览"
                  style={{ backgroundImage: `url("${draft.avatarUrl}")` }}
                />
              ) : (
                <span>{(draft.displayName || DEFAULT_PROFILE_SETTINGS.displayName).slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-700">头像</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">选择本地图片作为个人卡片头像，会自动压缩后保存。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="home-pill-button profile-avatar-upload">
                  选择头像
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => onAvatarChange(event.target.files?.[0] ?? null)}
                  />
                </label>
                {draft.avatarUrl && (
                  <button
                    type="button"
                    className="home-pill-button profile-edit-secondary"
                    onClick={() => onChange("avatarUrl", "")}
                  >
                    移除头像
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="profile-edit-error sm:col-span-2" role="alert">
              {error}
            </div>
          )}

          <label className="profile-edit-field">
            <span>用户名</span>
            <input
              className="home-field"
              value={draft.displayName}
              onChange={(event) => onChange("displayName", event.target.value)}
              placeholder="Skyler"
            />
          </label>
          <label className="profile-edit-field">
            <span>邮箱</span>
            <input
              className="home-field"
              value={draft.email}
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="name@example.com"
              type="email"
            />
          </label>
          <label className="profile-edit-field">
            <span>Github 超链接</span>
            <input
              className="home-field"
              value={draft.githubUrl}
              onChange={(event) => onChange("githubUrl", event.target.value)}
              placeholder="https://github.com/..."
            />
          </label>
          <label className="profile-edit-field">
            <span>QQ 超链接</span>
            <input
              className="home-field"
              value={draft.qqUrl}
              onChange={(event) => onChange("qqUrl", event.target.value)}
              placeholder="https://qm.qq.com/..."
            />
          </label>
        </div>

        <label className="profile-edit-field mt-4">
          <span>简介</span>
          <textarea
            className="home-field min-h-[96px] py-3"
            value={draft.intro}
            onChange={(event) => onChange("intro", event.target.value)}
            placeholder="写一点个人简介"
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="home-pill-button profile-edit-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="home-pill-button">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}

function PostCard({ post, index, dataReady = true }: { post: BlogPost; index: number; dataReady?: boolean }) {
  const imageHeights = [150, 210, 176, 238, 188, 260];
  const imageHeight = imageHeights[index % imageHeights.length];
  const coverBg = post.cover_url
    ? `url("${post.cover_url}")`
    : `linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)), var(--home-wallpaper-image, url('/images/home-background.png'))`;

  return (
    <Link href={`/articles/${post.id}`} className={`home-masonry-card block no-underline ${dataReady ? "card-fly-in" : "card-init-hidden"}`} style={dataReady ? { animationDelay: `${240 + index * 70}ms` } : undefined}>
      <article className="home-card home-clickable-card overflow-hidden">
        <div
          className="bg-cover bg-center shadow-inner"
          style={{
            height: imageHeight,
            backgroundImage: coverBg,
            backgroundPosition: index % 2 === 0 ? "center" : "70% center",
          }}
        />
        <div className="p-5">
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
      </article>
    </Link>
  );
}

function buildProfileSettings(user: AuthUser | null): ProfileSettings {
  const displayName = user?.nickname || user?.email?.split("@", 1)[0] || DEFAULT_PROFILE_SETTINGS.displayName;
  return {
    ...DEFAULT_PROFILE_SETTINGS,
    displayName,
    email: user?.email ?? "",
    intro: user?.email ? `Hello, ${user.email}` : DEFAULT_PROFILE_SETTINGS.intro,
  };
}

function loadProfileSettings(storageKey: string, baseSettings: ProfileSettings) {
  const savedRaw = window.localStorage.getItem(storageKey);
  if (!savedRaw) return baseSettings;

  try {
    const saved = JSON.parse(savedRaw) as Partial<ProfileSettings>;
    return normalizeProfileSettings({ ...baseSettings, ...saved });
  } catch {
    return baseSettings;
  }
}

function normalizeProfileSettings(settings: ProfileSettings): ProfileSettings {
  return {
    avatarUrl: settings.avatarUrl,
    displayName: settings.displayName.trim() || DEFAULT_PROFILE_SETTINGS.displayName,
    email: settings.email.trim(),
    githubUrl: normalizeUrl(settings.githubUrl),
    qqUrl: normalizeUrl(settings.qqUrl),
    intro: settings.intro.trim() || DEFAULT_PROFILE_SETTINGS.intro,
  };
}

function normalizeUrl(value: string) {
  const url = value.trim();
  if (!url) return "";
  if (/^(https?:|mailto:|tencent:)/i.test(url)) return url;
  return `https://${url}`;
}

async function compressAvatarFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const maxSize = 256;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/webp", 0.72)
      ?? await canvasToBlob(canvas, "image/jpeg", 0.72);
    if (!blob) return canvas.toDataURL("image/jpeg", 0.72);

    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function isQuotaExceededError(error: unknown) {
  return error instanceof DOMException && (
    error.name === "QuotaExceededError"
    || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error.code === 22
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
