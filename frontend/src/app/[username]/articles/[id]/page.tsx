"use client";

import { useParams, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import CommentSection from "@/components/CommentSection";
import { isOwnBlog } from "@/lib/auth";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type BlogPost = {
  id: number;
  title: string;
  content: string;
  category: string;
  cover_url: string;
  summary: string;
  tags: string[];
  created_at: string;
};

export default function PublicArticleDetailPage() {
  const { username, id } = useParams<{ username: string; id: string }>();
  const router = useRouter();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [message, setMessage] = useState("正在加载文章...");
  const owner = isOwnBlog(username);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/public/${username}/posts/${id}`);
      if (!res.ok) throw new Error("文章加载失败");
      setPost(await res.json());
      setMessage("");
    } catch (e) {
      setPost(null);
      setMessage(e instanceof Error ? e.message : "文章加载失败");
    }
  }, [username, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPost(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPost]);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <PublicHeader active="文章" username={username} isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} />

      <section className="article-detail-space relative z-10 mx-auto max-w-[1800px] px-4 py-8 sm:px-8 xl:pl-[200px] xl:pr-[200px]">
        {!post && (
          <div className="home-card p-6 text-sm font-semibold text-slate-700">{message}</div>
        )}

        {post && (
          <div className="article-detail-layout">
            <article className="home-card overflow-hidden relative">
              <button
                type="button"
                className="article-detail-back"
                onClick={() => router.push(`/${username}/articles`)}
                aria-label="返回"
              >
                ← 返回
              </button>
              <div
                className="article-detail-cover"
                style={post.cover_url ? { backgroundImage: `linear-gradient(135deg, rgb(16 185 129 / 0.18), rgb(14 165 233 / 0.2)), url("${post.cover_url}")` } : undefined}
              />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
                  <span className="rounded-lg bg-emerald-50 px-3 py-1 text-emerald-600">{post.category}</span>
                  <span>{formatDate(post.created_at)}</span>
                </div>
                <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{post.title}</h1>
                <p className="mt-5 text-base leading-8 text-slate-700">{post.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      #{tag}
                    </span>
                  ))}
                </div>
                <MarkdownContent content={post.content} />
              </div>
            </article>

            <CommentSection postId={post.id} isOwner={owner} />
          </div>
        )}
      </section>
    </main>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) { index += 1; continue; }

    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(<pre key={`code-${index}`} className="article-md-code"><code>{codeLines.join("\n")}</code></pre>);
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = renderInline(heading[2]);
      if (level === 1) blocks.push(<h2 key={`h-${index}`} className="article-md-h1">{text}</h2>);
      if (level === 2) blocks.push(<h3 key={`h-${index}`} className="article-md-h2">{text}</h3>);
      if (level === 3) blocks.push(<h4 key={`h-${index}`} className="article-md-h3">{text}</h4>);
      index += 1;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${index}`} className="article-md-hr" />);
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`} className="article-md-quote">{quoteLines.map((ql, qi) => <p key={qi}>{renderInline(ql)}</p>)}</blockquote>);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`} className="article-md-list">{items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}</ul>);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`} className="article-md-list article-md-ordered">{items.map((item, ii) => <li key={ii}>{renderInline(item)}</li>)}</ol>);
      continue;
    }

    const pLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !lines[index].trim().startsWith("```") && !/^(#{1,3})\s+/.test(lines[index]) && !/^[-*_]{3,}$/.test(lines[index].trim()) && !lines[index].startsWith(">") && !/^\s*[-*]\s+/.test(lines[index]) && !/^\s*\d+\.\s+/.test(lines[index])) {
      pLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`} className="article-md-paragraph">{renderInline(pLines.join(" "))}</p>);
  }

  return <div className="article-detail-content article-md-body mt-8">{blocks}</div>;
}

function renderInline(text: string) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="article-md-inline-code">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
