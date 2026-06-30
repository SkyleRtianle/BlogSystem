"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type FriendLink = {
  id: number;
  name: string;
  url: string;
  description: string;
  created_at: string;
};

export default function LinksPage() {
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [form, setForm] = useState({ name: "", url: "", description: "" });
  const [message, setMessage] = useState("提交友链后会保存到后端列表。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLinks = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/links`);
    if (!response.ok) return;
    const data: { links: FriendLink[]; total: number } = await response.json();
    setLinks(data.links);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLinks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLinks]);

  const submitLink = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.name.trim() || !form.url.trim()) {
        setMessage("站点名称和链接地址都需要填写");
        return;
      }

      setIsSubmitting(true);
      setMessage("正在提交友链...");
      try {
        const response = await fetch(`${API_BASE_URL}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("友链提交失败");
        const created: FriendLink = await response.json();
        setLinks((current) => [created, ...current]);
        setForm({ name: "", url: "", description: "" });
        setMessage("友链已提交");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "友链提交失败");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form],
  );

  return (
    <main className="home-shell min-h-screen text-slate-900">
      <SimpleHeader active="友链" />
      <section className="mx-auto grid max-w-[1400px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submitLink} className="home-card p-5 lg:sticky lg:top-24 lg:self-start">
          <h1 className="home-section-title">友链申请</h1>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">站点名称</span>
            <input className="home-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">链接地址</span>
            <input className="home-field" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com" />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">描述</span>
            <textarea className="home-field min-h-28 resize-y py-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">{message}</p>
            <button className="home-pill-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "提交中..." : "提交友链"}
            </button>
          </div>
        </form>

        <section className="space-y-4">
          <div className="home-card flex items-center justify-between p-4">
            <h2 className="home-section-title">友链列表</h2>
            <span className="text-sm font-semibold text-slate-500">共 {links.length} 个</span>
          </div>
          {links.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-500">暂无友链，提交后会显示在这里。</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {links.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="home-card block p-5 transition hover:-translate-y-0.5">
                <h3 className="text-xl font-bold">{item.name}</h3>
                <p className="mt-2 break-all text-sm text-emerald-600">{item.url}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description || "这个站点暂时没有描述。"}</p>
              </a>
            ))}
          </div>
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
