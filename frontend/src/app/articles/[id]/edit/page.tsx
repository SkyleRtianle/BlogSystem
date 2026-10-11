"use client";

import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

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

export default function ArticleEditPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthUser();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    category: "随笔",
    coverUrl: "",
    keywords: "",
    content: "",
  });
  const [message, setMessage] = useState("正在加载文章...");
  const [isSaving, setIsSaving] = useState(false);

  const fetchPost = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${params.id}`, {
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) throw new Error("文章加载失败");
      const post: BlogPost = await response.json();
      setEditor({
        title: post.title,
        category: post.category,
        coverUrl: post.cover_url,
        keywords: post.keyword_matches.join(" "),
        content: post.content,
      });
      setMessage("右键文章卡片可进入这里，保存后会重新生成摘要和标签。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文章加载失败");
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPost();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPost]);

  const selectCover = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      if (!file.type.startsWith("image/")) return;
      setCropperFile(file);
    },
    [],
  );

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

      setIsSaving(true);
      setMessage("正在保存修改...");

      try {
        const token = requireAuthToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/posts/${params.id}`, {
          method: "PUT",
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
        if (!response.ok) throw new Error("保存失败，请检查后端服务是否运行");
        setMessage("保存成功");
        router.push(`/articles/${params.id}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      } finally {
        setIsSaving(false);
      }
    },
    [editor, params.id, router],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="文章" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />

      <section className="article-edit-shell relative z-10 mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-8">
        <form onSubmit={submitPost} className="articles-composer">
          <div className="articles-panel-head">
            <h2>编辑文章</h2>
            <span className="articles-mini-badge">自动标签</span>
          </div>

          <label className="articles-field-group">
            <span>标题</span>
            <input
              value={editor.title}
              onChange={(event) => setEditor({ ...editor, title: event.target.value })}
              className="home-field"
            />
          </label>

          <div className="articles-editor-grid">
            <label className="articles-field-group">
              <span>分类</span>
              <input
                value={editor.category}
                onChange={(event) => setEditor({ ...editor, category: event.target.value })}
                className="home-field"
                placeholder="随笔"
              />
            </label>

            <div className="articles-field-group">
              <span>本地封面</span>
              <label className={`articles-cover-upload ${editor.coverUrl ? "articles-cover-upload-filled" : ""}`}>
                <input ref={coverInputRef} className="sr-only" type="file" accept="image/*" onChange={selectCover} />
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
                  onClick={() => setEditor({ ...editor, coverUrl: "" })}
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
              onChange={(event) => setEditor({ ...editor, keywords: event.target.value })}
              className="home-field"
              placeholder="用空格或逗号分隔"
            />
          </label>

          <label className="articles-field-group">
            <span>Markdown 正文</span>
            <textarea
              value={editor.content}
              onChange={(event) => setEditor({ ...editor, content: event.target.value })}
              className="home-field min-h-[420px] resize-y py-3 leading-7"
              placeholder={"# 继续编写\n\n修改后保存会重新生成摘要和标签。"}
            />
          </label>

          <div className="articles-submit-row">
            <p>{message}</p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" onClick={() => router.push("/articles")} className="article-edit-secondary">
                返回列表
              </button>
              <button type="submit" disabled={isSaving} className="articles-primary-button">
                {isSaving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </form>
      </section>
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
