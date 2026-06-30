"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

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
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState("在这里发布 Markdown 文章，系统会自动处理标签。");
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    category: "随笔",
    keywords: "",
    content: "",
  });

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

  return (
    <main className="home-shell min-h-screen text-slate-900">
      <SimpleHeader active="文章" />
      <section className="relative z-10 mx-auto grid max-w-[1600px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
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
            <div className="home-card p-6 text-sm font-semibold text-slate-500">正在加载文章...</div>
          )}
          {!isLoadingPosts && posts.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-500">
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

function SimpleHeader({ active }: { active: string }) {
  const items = [
    { label: "主页", href: "/home" },
    { label: "文章", href: "/articles" },
    { label: "照片墙", href: "/photos" },
    { label: "友链", href: "/links" },
    { label: "留言", href: "/messages" },
  ];

  return (
    <header className="sticky top-0 z-40 mx-auto max-w-[1720px] px-4 pt-3 sm:px-6">
      <nav className="home-nav flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/home" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-600">S</span>
          <span className="text-lg font-bold">Skyler Blog</span>
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-xl px-3 py-2 transition ${
                active === item.label ? "bg-emerald-500 text-white" : "hover:bg-emerald-50 hover:text-emerald-600"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
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
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">标题</span>
        <input
          value={editor.title}
          onChange={(event) => onChange({ ...editor, title: event.target.value })}
          className="home-field"
          placeholder="例如：FastAPI 博客发布接口设计"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">分类</span>
        <input
          value={editor.category}
          onChange={(event) => onChange({ ...editor, category: event.target.value })}
          className="home-field"
          placeholder="随笔"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">检索关键词</span>
        <input
          value={editor.keywords}
          onChange={(event) => onChange({ ...editor, keywords: event.target.value })}
          className="home-field"
          placeholder="用空格或逗号分隔"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-500">Markdown 正文</span>
        <textarea
          value={editor.content}
          onChange={(event) => onChange({ ...editor, content: event.target.value })}
          className="home-field min-h-72 resize-y py-3 leading-7"
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

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="home-card p-5">
      <h2 className="border-l-4 border-emerald-400 pl-4 text-2xl font-bold leading-tight">
        {post.title}
      </h2>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
        <span className="rounded-lg bg-emerald-50 px-3 py-1 font-medium text-emerald-600">已发布</span>
        <span>{formatDate(post.created_at)}</span>
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
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
