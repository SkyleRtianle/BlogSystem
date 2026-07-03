"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import {
  authHeaders,
  clearAuthSession,
  ensureAuthorized,
  redirectToLogin,
  requireAuthToken,
  useAuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import ImageCropper from "@/components/ImageCropper";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("封面读取失败"));
    };
    reader.onerror = () => reject(new Error("封面读取失败"));
    reader.readAsDataURL(file);
  });
}

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

type EditorState = {
  title: string;
  category: string;
  coverUrl: string;
  keywords: string;
  content: string;
};

type ContextMenuState = {
  postId: number;
  x: number;
  y: number;
};

export default function ArticlesPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState("在这里发布 Markdown 文章，系统会自动处理标签。");
  const [expandedTimelineKey, setExpandedTimelineKey] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const currentUser = useAuthUser();
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    category: "随笔",
    coverUrl: "",
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

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [contextMenu]);

  const deletePost = useCallback(async (postId: number) => {
    setContextMenu(null);
    try {
      const token = requireAuthToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) throw new Error("文章删除失败");
      setPosts((current) => current.filter((post) => post.id !== postId));
      setTotalPosts((current) => current - 1);
      setExpandedTimelineKey(null);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleCropperCrop = useCallback((dataUrl: string) => {
    setEditor((prev) => ({ ...prev, coverUrl: dataUrl }));
    setCropperFile(null);
  }, []);

  const handleCropperSkip = useCallback(async () => {
    if (!cropperFile) return;
    const dataUrl = await fileToDataUrl(cropperFile);
    setEditor((prev) => ({ ...prev, coverUrl: dataUrl }));
    setCropperFile(null);
  }, [cropperFile]);

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
            cover_url: editor.coverUrl,
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
        setEditor({ title: "", category: "随笔", coverUrl: "", keywords: "", content: "" });
        setMessage(`发布成功，已自动打上 ${createdPost.tags.length} 个标签`);
        setIsComposerOpen(false);
        setIsSearchOpen(false);
        setExpandedTimelineKey(null);
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
      setIsSearchOpen(false);
      void fetchPosts(searchKeyword);
    },
    [fetchPosts, searchKeyword],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  const timelineGroups = groupPostsByDate(posts);
  const expandedGroup = timelineGroups.find((group) => group.key === expandedTimelineKey) ?? null;

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="文章" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />
      <section className="articles-page articles-wall relative z-10 mx-auto w-full max-w-none px-0 pb-16 pt-8">
        <section
          className="articles-album-section"
          aria-label="文章流"
          onClick={() => setIsSearchOpen(false)}
        >
          <div className="articles-timeline-actions">
            <button
              type="button"
              className="articles-compose-button"
              aria-expanded={isComposerOpen}
              onClick={(event) => {
                event.stopPropagation();
                setIsSearchOpen(false);
                setExpandedTimelineKey(null);
                setIsComposerOpen(true);
              }}
            >
              写文章
            </button>
            <div className="articles-search-control" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={`articles-search-chip ${isSearchOpen ? "articles-search-chip-active" : ""}`}
                aria-expanded={isSearchOpen}
                aria-controls="articles-search-popover"
                onClick={() => setIsSearchOpen((isOpen) => !isOpen)}
              >
                <span>搜索文章</span>
                <strong>{totalPosts}</strong>
              </button>
              {isSearchOpen && (
                <div
                  id="articles-search-popover"
                  className="articles-search-popover"
                >
                  <SearchBar
                    keyword={searchKeyword}
                    isLoading={isLoadingPosts}
                    onKeywordChange={setSearchKeyword}
                    onSubmit={submitSearch}
                  />
                </div>
              )}
            </div>
          </div>
          {isLoadingPosts && (
            <div className="articles-album-grid">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="articles-album-skeleton" />
              ))}
            </div>
          )}
          {!isLoadingPosts && posts.length === 0 && (
            <div className="articles-wall-empty">
              <strong>这里还很安静</strong>
              <span>写下第一篇 Markdown 博客，它会出现在这里。</span>
            </div>
          )}
          {!isLoadingPosts && posts.length > 0 && (
            <div className="articles-timeline">
              {timelineGroups.map((group) => (
                <section
                  key={group.key}
                  className={`articles-timeline-group ${expandedTimelineKey === group.key ? "articles-timeline-group-expanded" : ""}`}
                >
                  <div className="articles-timeline-marker">
                    <span />
                    <time dateTime={group.key}>{group.label}</time>
                  </div>
                  <ArticleStack
                    posts={group.posts}
                    label={group.label}
                    isExpanded={expandedTimelineKey === group.key}
                    onExpand={() => setExpandedTimelineKey(group.key)}
                  />
                </section>
              ))}
            </div>
          )}
        </section>
      </section>
      {expandedGroup && (
        <section
          className="articles-fan-overlay"
          aria-label={`${expandedGroup.label} 的文章`}
          onClick={() => setExpandedTimelineKey(null)}
        >
          <div className="articles-fan-stage" onClick={(event) => event.stopPropagation()}>
            <time className="articles-fan-date" dateTime={expandedGroup.key}>
              {expandedGroup.label}
            </time>
            <div className={`articles-fan-grid ${expandedGroup.posts.length === 1 ? "articles-fan-grid-single" : ""}`}>
              {expandedGroup.posts.map((post, index) => {
                const rawFanIndex = index - (expandedGroup.posts.length - 1) / 2;
                const fanIndex = Math.max(-3, Math.min(3, rawFanIndex));
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    fanIndex={fanIndex}
                    onContextMenu={(event, postId) => setContextMenu({ postId, x: event.clientX, y: event.clientY })}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}
      {isComposerOpen && (
        <section
          className="articles-compose-overlay"
          aria-label="发布文章"
          onClick={() => setIsComposerOpen(false)}
        >
          <div className="articles-compose-stage" onClick={(event) => event.stopPropagation()}>
            <ArticleComposer
              editor={editor}
              isPublishing={isPublishing}
              message={message}
              onChange={setEditor}
              onSubmit={submitPost}
              onOpenCropper={setCropperFile}
            />
          </div>
        </section>
      )}
      {contextMenu && (
        <div
          className="photo-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => router.push(`/articles/${contextMenu.postId}/edit`)}>
            编辑文章
          </button>
          <button type="button" onClick={() => void deletePost(contextMenu.postId)}>
            删除文章
          </button>
        </div>
      )}
      {cropperFile && (
        <ImageCropper
          file={cropperFile}
          onCrop={handleCropperCrop}
          onSkip={() => void handleCropperSkip()}
          onClose={() => setCropperFile(null)}
        />
      )}
    </main>
  );
}

function ArticleStack({
  posts,
  label,
  isExpanded,
  onExpand,
}: {
  posts: BlogPost[];
  label: string;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const previewPosts = posts.slice(0, 3);

  return (
    <button
      type="button"
      className={`articles-day-stack ${isExpanded ? "articles-day-stack-active" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onExpand();
      }}
      aria-label={`展开 ${label} 的 ${posts.length} 篇文章`}
      aria-expanded={isExpanded}
    >
      <span className="articles-day-stack-count">{posts.length} 篇</span>
      {previewPosts.map((post, index) => (
        <span
          key={post.id}
          className="articles-day-stack-card"
          style={{ "--stack-index": index } as React.CSSProperties}
        >
          <span
            className={`articles-day-stack-cover ${post.cover_url ? "" : "articles-card-cover-empty"}`}
            style={post.cover_url ? { backgroundImage: `url("${post.cover_url}")` } : undefined}
          />
          <span className="articles-day-stack-title">{post.title}</span>
        </span>
      ))}
    </button>
  );
}

function ArticleComposer({
  editor,
  isPublishing,
  message,
  onChange,
  onSubmit,
  onOpenCropper,
}: {
  editor: EditorState;
  isPublishing: boolean;
  message: string;
  onChange: (nextEditor: EditorState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCropper: (file: File) => void;
}) {
  const selectCover = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      if (!file.type.startsWith("image/")) return;
      onOpenCropper(file);
    },
    [onOpenCropper],
  );

  return (
    <form onSubmit={onSubmit} className="articles-composer">
      <div className="articles-panel-head">
        <h2>发布 Markdown 博客</h2>
        <span className="articles-mini-badge">
          自动标签
        </span>
      </div>

      <label className="articles-field-group">
        <span>标题</span>
        <input
          value={editor.title}
          onChange={(event) => onChange({ ...editor, title: event.target.value })}
          className="home-field"
          placeholder="例如：FastAPI 博客发布接口设计"
        />
      </label>

      <div className="articles-editor-grid">
        <label className="articles-field-group">
          <span>分类</span>
          <input
            value={editor.category}
            onChange={(event) => onChange({ ...editor, category: event.target.value })}
            className="home-field"
            placeholder="随笔"
          />
        </label>

        <div className="articles-field-group">
          <span>本地封面</span>
          <label className={`articles-cover-upload ${editor.coverUrl ? "articles-cover-upload-filled" : ""}`}>
            <input className="sr-only" type="file" accept="image/*" onChange={selectCover} />
            {editor.coverUrl ? (
              <span
                className="articles-cover-preview"
                role="img"
                aria-label="文章封面预览"
                style={{ backgroundImage: `url("${editor.coverUrl}")` }}
              />
            ) : (
              <span className="articles-cover-placeholder">上传封面</span>
            )}
          </label>
          {editor.coverUrl && (
            <button
              type="button"
              className="articles-cover-clear"
              onClick={() => onChange({ ...editor, coverUrl: "" })}
            >
              移除封面
            </button>
          )}
        </div>
      </div>

      <label className="articles-field-group">
        <span>检索关键词</span>
        <input
          value={editor.keywords}
          onChange={(event) => onChange({ ...editor, keywords: event.target.value })}
          className="home-field"
          placeholder="用空格或逗号分隔"
        />
      </label>

      <label className="articles-field-group">
        <span>Markdown 正文</span>
        <textarea
          value={editor.content}
          onChange={(event) => onChange({ ...editor, content: event.target.value })}
          className="home-field min-h-56 resize-y py-3 leading-7"
          placeholder={"# 今天想写点什么\n\n支持直接输入 Markdown，发布后会自动生成摘要和标签。"}
        />
      </label>

      <div className="articles-submit-row">
        <p>{message}</p>
        <button
          type="submit"
          disabled={isPublishing}
          className="articles-primary-button"
        >
          {isPublishing ? "发布中..." : "发布博客"}
        </button>
      </div>
    </form>
  );
}

function SearchBar({
  keyword,
  isLoading,
  onKeywordChange,
  onSubmit,
}: {
  keyword: string;
  isLoading: boolean;
  onKeywordChange: (keyword: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="articles-search-card">
      <label>
        <input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          className="home-field"
          placeholder="搜索标题、摘要或 Markdown 正文"
        />
      </label>
      <button type="submit" aria-label="检索文章">
        {isLoading ? "检索中..." : "检索"}
      </button>
    </form>
  );
}

function PostCard({
  post,
  index,
  fanIndex = 0,
  onContextMenu,
}: {
  post: BlogPost;
  index: number;
  fanIndex?: number;
  onContextMenu: (event: MouseEvent, postId: number) => void;
}) {
  const isWide = index % 7 === 0;
  const readingMinutes = Math.max(1, Math.ceil(post.content.replace(/\s+/g, "").length / 450));
  const fanDistance = Math.abs(fanIndex);

  return (
    <Link
      href={`/articles/${post.id}`}
      className={`articles-album-card no-underline ${isWide ? "articles-album-card-wide" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event, post.id);
      }}
      style={{
        "--article-index": index,
        "--stack-x": `${fanIndex * 18}px`,
        "--stack-y": `${fanDistance * 4}px`,
        "--stack-rotate": `${fanIndex * 3.2}deg`,
        "--curve-x": `${fanIndex * 98}px`,
        "--curve-y": `${-132 + fanDistance * 10}px`,
        "--curve-rotate": `${fanIndex * 11}deg`,
        "--fan-x": `${fanIndex * 150}px`,
        "--fan-y": `${fanDistance * 42}px`,
        "--fan-mid-x": `${fanIndex * 52}px`,
        "--fan-mid-y": `${fanDistance * 8}px`,
        "--fan-rotate": `${fanIndex * 20}deg`,
        "--fan-mid-rotate": `${fanIndex * 6}deg`,
        "--fan-over-rotate": `${fanIndex * 22}deg`,
        "--fan-z": `${20 - fanDistance}`,
      } as React.CSSProperties}
    >
      <article>
        <div className="articles-card-paper">
          <div
            className={`articles-card-cover ${post.cover_url ? "" : "articles-card-cover-empty"}`}
            style={post.cover_url ? { backgroundImage: `url("${post.cover_url}")` } : undefined}
            aria-hidden="true"
          />
          <div className="articles-card-topline">
            <span>{post.category}</span>
            <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
          </div>
          <h3>{post.title}</h3>
          <p>{post.summary}</p>
          {post.keyword_matches.length > 0 && (
            <p className="articles-keyword-hit">
              命中关键词：{post.keyword_matches.join("、")}
            </p>
          )}
          <div className="articles-card-bottom">
            <span>{readingMinutes} 分钟</span>
            <span>{post.tags.slice(0, 2).map((tag) => `#${tag}`).join(" ") || "未归类"}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function groupPostsByDate(posts: BlogPost[]) {
  const groups = new Map<string, { key: string; label: string; posts: BlogPost[] }>();
  posts.forEach((post) => {
    const date = new Date(post.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(date);
    const group = groups.get(key) ?? { key, label, posts: [] };
    group.posts.push(post);
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
