"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

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

export default function PublicArticlesPage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [message, setMessage] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [expandedTimelineKey, setExpandedTimelineKey] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const fetchPosts = useCallback(async (keyword = "") => {
    setIsLoadingPosts(true);
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("keyword", keyword.trim());

    try {
      const response = await fetch(`${API_BASE_URL}/public/${username}/posts?${params.toString()}`);
      if (!response.ok) throw new Error("文章列表加载失败");
      const data: { posts: BlogPost[]; total: number } = await response.json();
      setPosts(data.posts);
      setTotalPosts(data.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文章列表加载失败");
    } finally {
      setIsLoadingPosts(false);
    }
  }, [username]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPosts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPosts]);

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

  const submitSearch = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSearchOpen(false);
    void fetchPosts(searchKeyword);
  }, [fetchPosts, searchKeyword]);

  const timelineGroups = groupPostsByDate(posts);
  const expandedGroup = timelineGroups.find((group) => group.key === expandedTimelineKey) ?? null;

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <PublicHeader active="文章" username={username} isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} />

      <section className="articles-page articles-wall page-fade-in relative z-10 mx-auto w-full max-w-none px-0 pb-16 pt-8">
        <section className="articles-album-section" aria-label="文章流" onClick={() => setIsSearchOpen(false)}>
          <div className="articles-timeline-actions card-fly-in" style={{ animationDelay: "0ms" }}>
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
                <div id="articles-search-popover" className="articles-search-popover">
                  <form onSubmit={submitSearch} className="articles-search-card">
                    <label>
                      <input value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="home-field" placeholder="搜索标题、摘要或 Markdown 正文" />
                    </label>
                    <button type="submit" aria-label="检索文章">{isLoadingPosts ? "检索中..." : "检索"}</button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {isLoadingPosts && (
            <div className="articles-skeleton-timeline">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="articles-skeleton-group">
                  <div className="articles-skeleton-marker">
                    <div className="articles-skeleton-dot" />
                    <div className="articles-skeleton-date" />
                  </div>
                  <div className="articles-skeleton-card" />
                </div>
              ))}
            </div>
          )}

          {!isLoadingPosts && posts.length === 0 && (
            <div className="articles-wall-empty">
              <strong>这里还很安静</strong>
              <span>还没有文章发布。</span>
            </div>
          )}

          {!isLoadingPosts && posts.length > 0 && (
            <div className="articles-timeline">
              {timelineGroups.map((group, gi) => (
                <section key={group.key} className={`articles-timeline-group ${dataReady ? "card-fly-in" : "card-init-hidden"} ${expandedTimelineKey === group.key ? "articles-timeline-group-expanded" : ""}`} style={dataReady ? { animationDelay: `${gi * 100}ms` } : undefined}>
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
        <section className="articles-fan-overlay" aria-label={`${expandedGroup.label} 的文章`} onClick={() => setExpandedTimelineKey(null)}>
          <div className="articles-fan-stage" onClick={(e) => e.stopPropagation()}>
            <time className="articles-fan-date" dateTime={expandedGroup.key}>{expandedGroup.label}</time>
            <div className={`articles-fan-grid ${expandedGroup.posts.length === 1 ? "articles-fan-grid-single" : ""}`}>
              {expandedGroup.posts.map((post, index) => {
                const rawFanIndex = index - (expandedGroup.posts.length - 1) / 2;
                const fanIndex = Math.max(-3, Math.min(3, rawFanIndex));
                return <PublicPostCard key={post.id} post={post} index={index} fanIndex={fanIndex} username={username} />;
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function ArticleStack({ posts, label, isExpanded, onExpand }: {
  posts: BlogPost[];
  label: string;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const previewPosts = posts.slice(0, 3);
  return (
    <button type="button" className={`articles-day-stack ${isExpanded ? "articles-day-stack-active" : ""}`}
      onClick={(e) => { e.stopPropagation(); onExpand(); }}
      aria-label={`展开 ${label} 的 ${posts.length} 篇文章`} aria-expanded={isExpanded}>
      <span className="articles-day-stack-count">{posts.length} 篇</span>
      {previewPosts.map((post, index) => (
        <span key={post.id} className="articles-day-stack-card" style={{ "--stack-index": index } as React.CSSProperties}>
          <span className={`articles-day-stack-cover ${post.cover_url ? "" : "articles-card-cover-empty"}`}
            style={post.cover_url ? { backgroundImage: `url("${post.cover_url}")` } : undefined} />
          <span className="articles-day-stack-title">{post.title}</span>
        </span>
      ))}
    </button>
  );
}

function PublicPostCard({ post, index, fanIndex = 0, username }: {
  post: BlogPost;
  index: number;
  fanIndex?: number;
  username: string;
}) {
  const isWide = index % 7 === 0;
  const readingMinutes = Math.max(1, Math.ceil(post.content.replace(/\s+/g, "").length / 450));
  const fanDistance = Math.abs(fanIndex);

  return (
    <Link href={`/${username}/articles/${post.id}`}
      className={`articles-album-card no-underline ${isWide ? "articles-album-card-wide" : ""}`}
      onClick={(e) => e.stopPropagation()}
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
      } as React.CSSProperties}>
      <article>
        <div className="articles-card-paper">
          <div className={`articles-card-cover ${post.cover_url ? "" : "articles-card-cover-empty"}`}
            style={post.cover_url ? { backgroundImage: `url("${post.cover_url}")` } : undefined} aria-hidden="true" />
          <div className="articles-card-topline">
            <span>{post.category}</span>
            <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
          </div>
          <h3>{post.title}</h3>
          <p>{post.summary}</p>
          {post.keyword_matches.length > 0 && (
            <p className="articles-keyword-hit">命中关键词：{post.keyword_matches.join("、")}</p>
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
