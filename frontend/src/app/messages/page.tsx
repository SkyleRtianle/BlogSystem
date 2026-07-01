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
  type AuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type Message = {
  id: number;
  author: string;
  content: string;
  created_at: string;
};

export default function MessagesPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [form, setForm] = useState({ author: "", content: "" });
  const [tip, setTip] = useState("写下留言，提交后会展示在留言墙。");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useAuthUser();

  const fetchMessages = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        headers: authHeaders(token),
      });
      ensureAuthorized(response);
      if (!response.ok) {
        throw new Error("留言列表加载失败");
      }
      const data: { messages: Message[]; total: number } = await response.json();
      setMessages(data.messages);
    } catch (error) {
      setMessages([]);
      setTip(error instanceof Error ? error.message : "留言列表加载失败");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMessages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMessages]);

  const submitMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.author.trim() || !form.content.trim()) {
        setTip("昵称和留言内容都需要填写");
        return;
      }

      setIsSubmitting(true);
      setTip("正在提交留言...");
      try {
        const token = requireAuthToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify(form),
        });
        ensureAuthorized(response);
        if (!response.ok) throw new Error("留言提交失败");
        const created: Message = await response.json();
        setMessages((current) => [created, ...current]);
        setForm({ author: "", content: "" });
        setTip("留言已发布");
      } catch (error) {
        setTip(error instanceof Error ? error.message : "留言提交失败");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    redirectToLogin();
  }, []);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="留言" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />
      <section className="mx-auto grid max-w-[1400px] gap-5 px-[80px] py-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submitMessage} className="home-card p-5 lg:sticky lg:top-24 lg:self-start">
          <h1 className="home-section-title">留言板</h1>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">昵称</span>
            <input className="home-field" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">留言内容</span>
            <textarea className="home-field min-h-36 resize-y py-3 leading-7" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">{tip}</p>
            <button className="home-pill-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "发布中..." : "发布留言"}
            </button>
          </div>
        </form>

        <section className="space-y-4">
          <div className="home-card flex items-center justify-between p-4">
            <h2 className="home-section-title">留言墙</h2>
            <span className="text-sm font-semibold text-slate-700">共 {messages.length} 条</span>
          </div>
          {messages.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-700">暂无留言，发布后会显示在这里。</div>
          )}
          {messages.map((item) => (
            <article key={item.id} className="home-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{item.author}</h3>
                <span className="text-sm text-slate-700">{formatDate(item.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">{item.content}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
