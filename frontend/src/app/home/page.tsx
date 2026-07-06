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
import { useAppSettings } from "@/lib/useAppSettings";

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

type ProfileSettings = {
  avatarUrl: string;
  displayName: string;
  email: string;
  githubUrl: string;
  qqUrl: string;
  intro: string;
  notice: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

const DEFAULT_NOTICE =
  "欢迎来到我的博客！页面骨架已拆分为首页、文章、照片墙、友链和留言，后续可以继续细化权限、详情页和后台管理。";

const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  avatarUrl: "",
  displayName: "Skyler",
  email: "",
  githubUrl: "",
  qqUrl: "",
  intro: "Hello, I am Skyler.",
  notice: DEFAULT_NOTICE,
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPosts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPosts]);

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

      <section
        className="home-content-panel relative z-10 px-[80px] pb-16 mt-[380px] xl:mt-0 pt-8"
      >
        <div className="home-dashboard-grid mx-auto grid max-w-[1700px] gap-5 xl:grid-cols-[1fr_3fr_1fr]">
          <aside className="home-static-column space-y-5 xl:self-start">
            <ProfileCard user={currentUser} settings={profileSettings} onEdit={openProfileEditor} />
            <NoticeCard notice={profileSettings.notice} />
          </aside>

          <section data-home-scroll-column className="home-scroll-column">
            <LatestPosts posts={posts} isLoading={isLoadingPosts} error={postsError} categories={categories} />
          </section>

          <aside className="home-static-column space-y-5 xl:self-start">
            <CalendarCard />
            <StatsCard stats={homeStats} />
          </aside>
        </div>
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
      {posts.length > 0 && (
        <div className="home-masonry-feed">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileCard({
  user,
  settings,
  onEdit,
}: {
  user: AuthUser | null;
  settings: ProfileSettings;
  onEdit: () => void;
}) {
  const displayName = settings.displayName || user?.nickname || user?.email?.split("@", 1)[0] || "Skyler";
  const email = settings.email || user?.email || "";
  const intro = settings.intro || DEFAULT_PROFILE_SETTINGS.intro;
  const initial = displayName.slice(0, 1).toUpperCase();
  const links = [
    { label: "Github", icon: "github" as const, href: settings.githubUrl },
    { label: "邮箱", icon: "mail" as const, href: email ? `mailto:${email}` : "" },
    { label: "QQ", icon: "qq" as const, href: settings.qqUrl },
  ];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit();
    }
  };

  return (
    <div
      className="home-card profile-card-button p-4 text-center"
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={handleKeyDown}
      aria-label="编辑个人卡片"
    >
      <div className="profile-avatar-frame mx-auto">
        {settings.avatarUrl ? (
          <span
            className="profile-avatar-image"
            role="img"
            aria-label={`${displayName} 的头像`}
            style={{ backgroundImage: `url("${settings.avatarUrl}")` }}
          />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <h2 className="mt-4 truncate text-xl font-bold">{displayName}</h2>
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-emerald-400" />
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-700">{intro}</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {links.map((item) => (
          item.href ? (
            <a
              key={item.label}
              href={item.href}
              className="home-contact-icon-button"
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              onClick={(event) => event.stopPropagation()}
              aria-label={item.label}
              title={item.label}
            >
              <ContactIcon name={item.icon} />
            </a>
          ) : (
            <span
              key={item.label}
              className="home-contact-icon-button profile-link-disabled"
              aria-label={item.label}
              title={item.label}
            >
              <ContactIcon name={item.icon} />
            </span>
          )
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-emerald-600/80">点击卡片编辑资料</p>
    </div>
  );
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

function NoticeCard({ notice }: { notice: string }) {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">公告</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{notice || DEFAULT_NOTICE}</p>
    </div>
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
            <p className="mt-1 text-sm text-slate-600">主页展示信息和公告会按当前账号保存。</p>
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

        <label className="profile-edit-field mt-4">
          <span>博客公告</span>
          <textarea
            className="home-field min-h-[116px] py-3"
            value={draft.notice}
            onChange={(event) => onChange("notice", event.target.value)}
            placeholder={DEFAULT_NOTICE}
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

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  const imageHeights = [150, 210, 176, 238, 188, 260];
  const imageHeight = imageHeights[index % imageHeights.length];
  const coverBg = post.cover_url
    ? `url("${post.cover_url}")`
    : `linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)), url('/images/home-background.png')`;

  return (
    <Link href={`/articles/${post.id}`} className="home-masonry-card block no-underline">
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
  const today = useMemo(() => stripTime(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const calendarCells = useMemo(() => buildCalendarCells(visibleMonth), [visibleMonth]);
  const monthTitle = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(visibleMonth);
  const selectedLabel = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(selectedDate);

  const goPreviousMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, -1));
  }, []);

  const goNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const goToday = useCallback(() => {
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(today);
  }, [today]);

  return (
    <div className="home-card p-4">
      <div className="flex items-center justify-between">
        <button type="button" className="calendar-nav-button" onClick={goPreviousMonth} aria-label="上个月">
          ‹
        </button>
        <button type="button" className="calendar-title-button" onClick={goToday} title="回到今天">
          {monthTitle}
        </button>
        <button type="button" className="calendar-nav-button" onClick={goNextMonth} aria-label="下个月">
          ›
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-700">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day} className="calendar-weekday">{day}</span>
        ))}
        {calendarCells.map((date) => (
          <button
            key={date.toISOString()}
            type="button"
            className={[
              "calendar-day-button",
              isSameMonth(date, visibleMonth) ? "" : "calendar-day-muted",
              isSameDate(date, today) ? "calendar-day-today" : "",
              isSameDate(date, selectedDate) ? "calendar-day-selected" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => setSelectedDate(date)}
            aria-pressed={isSameDate(date, selectedDate)}
            aria-label={new Intl.DateTimeFormat("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(date)}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
      <div className="calendar-selected-note" suppressHydrationWarning>{selectedLabel}</div>
    </div>
  );
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarCells(month: Date) {
  const firstDay = startOfMonth(month);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameDate(a: Date, b: Date) {
  return isSameMonth(a, b) && a.getDate() === b.getDate();
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
    notice: settings.notice.trim() || DEFAULT_NOTICE,
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
