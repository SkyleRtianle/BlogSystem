"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent, WheelEvent } from "react";

type HomeMode = "transparent" | "wallpaper" | "solid" | "night";

const navItems = ["主页", "文章", "友链", "留言", "我的", "关于", "链接"];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

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

type EditorState = {
  title: string;
  category: string;
  keywords: string;
  content: string;
};

const modeItems: Array<{ key: HomeMode; label: string }> = [
  { key: "transparent", label: "透明" },
  { key: "wallpaper", label: "壁纸" },
  { key: "solid", label: "纯色" },
  { key: "night", label: "夜间" },
];

const stats = [
  ["总字数", "13,344"],
  ["运行时长", "541 天"],
  ["最后活动", "20627 天前"],
];

const siteInfo = [
  ["构建平台", "Unknown CI"],
  ["博客版本", "Skyler v0.1.0"],
  ["文章许可", "CC BY-NC-SA 4.0"],
];

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);

export default function HomePage() {
  const [mode, setMode] = useState<HomeMode>("transparent");
  const [wallpaperEntered, setWallpaperEntered] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("准备发布第一篇 Markdown 博客");
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    category: "随笔",
    keywords: "",
    content: "",
  });
  const touchStartY = useRef<number | null>(null);

  const fetchPosts = useCallback(async (keyword = "") => {
    setIsLoadingPosts(true);
    const params = new URLSearchParams();
    if (keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("文章列表加载失败");
      }
      const data: { posts: BlogPost[]; total: number } = await response.json();
      setPosts(data.posts);
      setTotalPosts(data.total);
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "文章列表加载失败");
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

  const handleWallpaperWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY > 18) {
        enterWallpaperContent();
      }
    },
    [enterWallpaperContent],
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
      if (startY - endY > 42) {
        enterWallpaperContent();
      }
    },
    [enterWallpaperContent],
  );

  const hasWallpaper = mode === "transparent" || mode === "wallpaper";
  const showHero = mode === "wallpaper" && !wallpaperEntered;
  const categories = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.category] = (acc[post.category] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [posts]);

  const dynamicStats = useMemo(() => {
    const tags = new Set(posts.flatMap((post) => post.tags));
    const wordCount = posts.reduce((sum, post) => sum + post.content.length, 0);

    return [
      ["文章", String(totalPosts)],
      ["分类", String(categories.length)],
      ["标签", String(tags.size)],
      ["总字数", wordCount.toLocaleString()],
      ...stats.slice(1),
    ];
  }, [categories.length, posts, totalPosts]);

  const submitPost = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editor.title.trim() || !editor.content.trim()) {
        setPublishMessage("标题和 Markdown 正文都需要填写");
        return;
      }

      setIsPublishing(true);
      setPublishMessage("正在发布并自动生成标签...");

      try {
        const response = await fetch(`${API_BASE_URL}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editor.title,
            content: editor.content,
            category: editor.category,
            keywords: editor.keywords
              .split(/[,，\s]+/)
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          }),
        });

        if (!response.ok) {
          throw new Error("发布失败，请检查后端服务是否运行");
        }

        const createdPost: BlogPost = await response.json();
        setPosts((currentPosts) => [createdPost, ...currentPosts]);
        setTotalPosts((currentTotal) => currentTotal + 1);
        setEditor({ title: "", category: "随笔", keywords: "", content: "" });
        setPublishMessage(`发布成功，已自动打上 ${createdPost.tags.length} 个标签`);
      } catch (error) {
        setPublishMessage(error instanceof Error ? error.message : "发布失败");
      } finally {
        setIsPublishing(false);
      }
    },
    [editor],
  );

  const submitSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void fetchPosts(searchKeyword);
    },
    [fetchPosts, searchKeyword],
  );

  const shellClass = useMemo(() => {
    const base = "home-shell min-h-screen";
    if (mode === "night") return `${base} home-night bg-slate-950 text-slate-100`;
    if (mode === "solid") return `${base} bg-[#eef8f2] text-slate-900`;
    return `${base} text-slate-900`;
  }, [mode]);

  return (
    <main className={shellClass}>
      {hasWallpaper && (
        <>
          <div className="home-global-wallpaper" />
          <div className={mode === "transparent" ? "home-wallpaper-veil" : "home-hero-veil"} />
        </>
      )}

      <header className="sticky top-0 z-40 mx-auto max-w-[1720px] px-4 pt-3 sm:px-6">
        <nav className="home-nav flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-600">
              S
            </span>
            <span className="truncate text-lg font-bold">Skyler Blog</span>
          </div>

          <div className="hidden items-center gap-6 text-sm font-semibold lg:flex">
            {navItems.map((item) => (
              <button key={item} type="button" className="transition hover:text-emerald-500">
                {item}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden h-11 w-40 items-center rounded-xl bg-slate-100/70 px-4 text-sm text-slate-400 xl:flex">
              搜索
            </label>
            <button type="button" className="home-icon-button" aria-label="music">
              ♪
            </button>
            <button type="button" className="home-icon-button" aria-label="play">
              ▶
            </button>
            <div className="hidden rounded-xl bg-white/30 p-1 shadow-inner md:flex">
              {modeItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectMode(item.key)}
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
            <p className="mt-3 text-sm font-medium text-white/75">向上滑动进入主页</p>
          </div>
        </section>
      )}

      <section
        className={`relative z-10 px-4 pb-16 sm:px-6 ${
          showHero ? "home-content-after-wallpaper pointer-events-none opacity-0" : "pt-6"
        } ${
          mode === "wallpaper" && wallpaperEntered ? "home-content-enter" : ""
        }`}
      >
        <div className="mx-auto grid max-w-[1600px] gap-5 xl:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]">
          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <ProfileCard />
            <MusicCard />
            <NoticeCard />
            <CategoryCard categories={categories} />
            <StatsCard stats={dynamicStats} />
            <SiteInfoCard />
            <CalendarCard />
          </aside>

          <section className="space-y-5">
            <BlogComposer
              editor={editor}
              isPublishing={isPublishing}
              message={publishMessage}
              onChange={setEditor}
              onSubmit={submitPost}
            />
            <SearchBar
              keyword={searchKeyword}
              total={totalPosts}
              isLoading={isLoadingPosts}
              onKeywordChange={setSearchKeyword}
              onSubmit={submitSearch}
            />
            <CategoryTabs categories={categories} />
            {isLoadingPosts && (
              <div className="home-card p-6 text-sm font-semibold text-slate-500">正在加载文章...</div>
            )}
            {!isLoadingPosts && posts.length === 0 && (
              <div className="home-card p-6 text-sm leading-7 text-slate-500">
                还没有文章。写一篇 Markdown 博客发布后，它会出现在这里。
              </div>
            )}
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

function ProfileCard() {
  return (
    <div className="home-card p-5 text-center">
      <div className="mx-auto grid aspect-square w-full max-w-[240px] place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 via-white to-sky-100 text-7xl font-bold text-emerald-600 shadow-inner">
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
        欢迎来到我的博客！这里是一则示例公告，后续会接入后台配置。
      </p>
      <div className="mt-5 flex items-center justify-between">
        <button type="button" className="home-pill-button">了解更多</button>
        <button type="button" className="home-square-button">×</button>
      </div>
    </div>
  );
}

function MusicCard() {
  return (
    <div className="home-card p-5">
      <h2 className="home-section-title">音乐</h2>
      <div className="mt-4 flex items-center gap-3">
        <div className="size-14 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-300" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">使一颗心免于哀伤</p>
          <p className="truncate text-xs text-slate-500">HOYO-MiX / Chevy</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-slate-200">
        <div className="h-full w-2/3 rounded-full bg-emerald-400" />
      </div>
      <div className="mt-5 flex items-center justify-around text-lg text-slate-500">
        <button type="button">↺</button>
        <button type="button">◀</button>
        <button type="button" className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">▶</button>
        <button type="button">▶</button>
        <button type="button">≡</button>
      </div>
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

function CategoryTabs({ categories }: { categories: Array<{ name: string; count: number }> }) {
  return (
    <div className="home-card flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
          主页
        </button>
        {categories.map((category) => (
          <button key={category.name} type="button" className="home-pill-button">
            {category.name}
            <span className="ml-2 text-emerald-400">{category.count}</span>
          </button>
        ))}
      </div>
      <button type="button" className="home-pill-button">更多 ›</button>
    </div>
  );
}

function BlogComposer({
  editor,
  isPublishing,
  message,
  onChange,
  onSubmit,
}: {
  editor: EditorState;
  isPublishing: boolean;
  message: string;
  onChange: (nextEditor: EditorState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="home-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="home-section-title">发布 Markdown 博客</h2>
        <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
          自动标签
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-500">标题</span>
          <input
            value={editor.title}
            onChange={(event) => onChange({ ...editor, title: event.target.value })}
            className="home-field"
            placeholder="例如：FastAPI 博客发布接口设计"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-slate-500">分类</span>
          <input
            value={editor.category}
            onChange={(event) => onChange({ ...editor, category: event.target.value })}
            className="home-field"
            placeholder="随笔"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">检索关键词</span>
        <input
          value={editor.keywords}
          onChange={(event) => onChange({ ...editor, keywords: event.target.value })}
          className="home-field"
          placeholder="用空格或逗号分隔，发布后会记录正文命中的关键词"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">Markdown 正文</span>
        <textarea
          value={editor.content}
          onChange={(event) => onChange({ ...editor, content: event.target.value })}
          className="home-field min-h-56 resize-y py-3 leading-7"
          placeholder={"# 今天想写点什么\n\n支持直接输入 Markdown，发布后会自动生成摘要和标签。"}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{message}</p>
        <button
          type="submit"
          disabled={isPublishing}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPublishing ? "发布中..." : "发布博客"}
        </button>
      </div>
    </form>
  );
}

function SearchBar({
  keyword,
  total,
  isLoading,
  onKeywordChange,
  onSubmit,
}: {
  keyword: string;
  total: number;
  isLoading: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="home-card flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-[220px] flex-1">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">文章关键词检索</span>
        <input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          className="home-field"
          placeholder="搜索标题、摘要或 Markdown 正文"
        />
      </label>
      <button type="submit" className="home-pill-button h-11">
        {isLoading ? "检索中..." : "检索"}
      </button>
      <span className="pb-2 text-sm font-semibold text-slate-500">共 {total} 篇</span>
    </form>
  );
}

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  const date = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    new Date(post.created_at),
  );

  return (
    <article className="home-card grid gap-5 p-5 lg:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_360px]">
      <div>
        <h2 className="border-l-4 border-emerald-400 pl-4 text-2xl font-bold leading-tight">
          {post.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
          <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">
            已发布
          </span>
          <span>{date}</span>
          <span>{post.category}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">{post.summary}</p>
        {post.keyword_matches.length > 0 && (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            命中关键词：{post.keyword_matches.join("、")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div
        className="min-h-44 rounded-2xl bg-cover bg-center shadow-inner"
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
      <button type="button" className="mx-auto mt-5 block text-sm font-semibold text-emerald-500">
        展开构建信息
      </button>
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
            className={`rounded-lg py-1.5 ${day === 25 ? "border border-emerald-400 text-emerald-600" : ""}`}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}
