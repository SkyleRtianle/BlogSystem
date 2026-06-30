"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type Message = {
  id: number;
  author: string;
  content: string;
  created_at: string;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [form, setForm] = useState({ author: "", content: "" });
  const [tip, setTip] = useState("写下留言，提交后会展示在留言墙。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMessages = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/messages`);
    if (!response.ok) return;
    const data: { messages: Message[]; total: number } = await response.json();
    setMessages(data.messages);
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
        const response = await fetch(`${API_BASE_URL}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
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

  return (
    <main className="home-shell min-h-screen text-slate-900">
      <SimpleHeader active="留言" />
      <section className="mx-auto grid max-w-[1400px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submitMessage} className="home-card p-5 lg:sticky lg:top-24 lg:self-start">
          <h1 className="home-section-title">留言板</h1>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">昵称</span>
            <input className="home-field" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">留言内容</span>
            <textarea className="home-field min-h-36 resize-y py-3 leading-7" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">{tip}</p>
            <button className="home-pill-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "发布中..." : "发布留言"}
            </button>
          </div>
        </form>

        <section className="space-y-4">
          <div className="home-card flex items-center justify-between p-4">
            <h2 className="home-section-title">留言墙</h2>
            <span className="text-sm font-semibold text-slate-500">共 {messages.length} 条</span>
          </div>
          {messages.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-500">暂无留言，发布后会显示在这里。</div>
          )}
          {messages.map((item) => (
            <article key={item.id} className="home-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{item.author}</h3>
                <span className="text-sm text-slate-500">{formatDate(item.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{item.content}</p>
            </article>
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
            <Link key={item.label} href={item.href} className={`rounded-xl px-3 py-2 transition ${active === item.label ? "bg-emerald-500 text-white" : "hover:bg-emerald-50 hover:text-emerald-600"}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
