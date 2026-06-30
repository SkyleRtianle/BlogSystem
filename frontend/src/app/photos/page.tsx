"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type Photo = {
  id: number;
  title: string;
  image_url: string;
  description: string;
  created_at: string;
};

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [form, setForm] = useState({ title: "", image_url: "", description: "" });
  const [message, setMessage] = useState("添加照片链接后，会展示在照片墙。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPhotos = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/photos`);
    if (!response.ok) return;
    const data: { photos: Photo[]; total: number } = await response.json();
    setPhotos(data.photos);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPhotos();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchPhotos]);

  const submitPhoto = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.title.trim() || !form.image_url.trim()) {
        setMessage("照片标题和图片地址都需要填写");
        return;
      }

      setIsSubmitting(true);
      setMessage("正在添加照片...");
      try {
        const response = await fetch(`${API_BASE_URL}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!response.ok) throw new Error("照片添加失败");
        const created: Photo = await response.json();
        setPhotos((current) => [created, ...current]);
        setForm({ title: "", image_url: "", description: "" });
        setMessage("照片已加入照片墙");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "照片添加失败");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form],
  );

  return (
    <main className="home-shell min-h-screen text-slate-900">
      <SimpleHeader active="照片墙" />
      <section className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={submitPhoto} className="home-card p-5 xl:sticky xl:top-24 xl:self-start">
          <h1 className="home-section-title">添加照片</h1>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">照片标题</span>
            <input
              className="home-field"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="例如：夏天的海边"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">图片地址</span>
            <input
              className="home-field"
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-500">描述</span>
            <textarea
              className="home-field min-h-28 resize-y py-3"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="记录照片背后的故事"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">{message}</p>
            <button className="home-pill-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "添加中..." : "加入照片墙"}
            </button>
          </div>
        </form>

        <section className="space-y-4">
          <div className="home-card flex items-center justify-between p-4">
            <h2 className="home-section-title">照片墙</h2>
            <span className="text-sm font-semibold text-slate-500">共 {photos.length} 张</span>
          </div>
          {photos.length === 0 && (
            <div className="home-card p-6 text-sm leading-7 text-slate-500">
              暂无照片。添加图片地址后，会以照片卡片形式展示在这里。
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {photos.map((photo) => (
              <article key={photo.id} className="home-card overflow-hidden">
                <div
                  className="aspect-[4/3] bg-cover bg-center"
                  style={{ backgroundImage: `url("${photo.image_url}")` }}
                />
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-bold">{photo.title}</h3>
                    <span className="text-xs font-semibold text-slate-500">{formatDate(photo.created_at)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {photo.description || "这张照片暂时没有描述。"}
                  </p>
                </div>
              </article>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}
