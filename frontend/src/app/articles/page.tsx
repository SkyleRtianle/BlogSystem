"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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

export default function ArticlesPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState("在这里发布 Markdown 文章，系统会自动处理标签。");
  const currentUser = useAuthUser();
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    category: "随笔",
    keywords: "",
    content: "",
  });

  const fetchPosts = useCallback(async (keyword = "") => {
    const token = requireAuthToken();
    if (!token) {
      setIsLoadingPosts(false);
      return;
    }

    setIsLoadingPosts(true);
    const params = new URLSearchParams();
    if (keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/posts?${params.toString()}`, {
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
      setMessage(error instanceof Error ? error.message : "文章列表加载失败");
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

  const submitPost = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editor.title.trim() || !editor.content.trim()) {
        setMessage("标题和 Markdown 正文都需要填写");
        return;
      }

      setIsPublishing(true);
      setMessage("正在发布并自动生成标签...");

      try {
        const token = requireAuthToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
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

        ensureAuthorized(response);
        if (!response.ok) {
          throw new Error("发布失败，请检查后端服务是否运行");
        }

        const createdPost: BlogPost = await response.json();
        setPosts((currentPosts) => [createdPost, ...currentPosts]);
        setTotalPosts((currentTotal) => currentTotal + 1);
        setEditor({ title: "", category: "随笔", keywords: "", content: "" });
        setMessage(`发布成功，已自动打上 ${createdPost.tags.length} 个标签`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发布失败");
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

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="文章" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />
      <section className="relative z-10 mx-auto grid max-w-[1600px] gap-5 px-[80px] py-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <ArticleComposer
            editor={editor}
            isPublishing={isPublishing}
            message={message}
            onChange={setEditor}
            onSubmit={submitPost}
          />
        </aside>

        <section className="space-y-5">
          <SearchBar
            keyword={searchKeyword}
            total={totalPosts}
            isLoading={isLoadingPosts}
            onKeywordChange={setSearchKeyword}
            onSubmit={submitSearch}
          />
          {isLoadingPosts && (
            <div className="home-card p-6 text-sm font-semibold text-slate-700">正在加载文章...</div>
          )}
          {!isLoadingPosts && posts.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-700">
              还没有文章。左侧写一篇 Markdown 博客发布后，它会出现在这里。
            </div>
          )}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </section>
      </section>
    </main>
  );
}

function ArticleComposer({
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
        <h1 className="home-section-title">发布 Markdown 博客</h1>
        <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
          自动标签
        </span>
      </div>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">标题</span>
        <input
          value={editor.title}
          onChange={(event) => onChange({ ...editor, title: event.target.value })}
          className="home-field"
          placeholder="例如：FastAPI 博客发布接口设计"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">分类</span>
        <input
          value={editor.category}
          onChange={(event) => onChange({ ...editor, category: event.target.value })}
          className="home-field"
          placeholder="随笔"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">检索关键词</span>
        <input
          value={editor.keywords}
          onChange={(event) => onChange({ ...editor, keywords: event.target.value })}
          className="home-field"
          placeholder="用空格或逗号分隔"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Markdown 正文</span>
        <textarea
          value={editor.content}
          onChange={(event) => onChange({ ...editor, content: event.target.value })}
          className="home-field min-h-72 resize-y py-3 leading-7"
          placeholder={"# 今天想写点什么\n\n支持直接输入 Markdown，发布后会自动生成摘要和标签。"}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{message}</p>
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
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">文章关键词检索</span>
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
      <span className="pb-2 text-sm font-semibold text-slate-700">共 {total} 篇</span>
    </form>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/articles/${post.id}`} className="block no-underline">
      <article className="home-card home-clickable-card p-5">
        <h2 className="border-l-4 border-emerald-400 pl-4 text-2xl font-bold leading-tight">
          {post.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
          <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">已发布</span>
          <span>{formatDate(post.created_at)}</span>
          <span>{post.category}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-800">{post.summary}</p>
        {post.keyword_matches.length > 0 && (
          <p className="mt-3 text-xs font-semibold text-slate-700">
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
      </article>
    </Link>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
