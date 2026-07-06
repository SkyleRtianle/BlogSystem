
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, saveAuthSession } from "@/lib/auth";

type AuthMode = "login" | "register";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthErrorMessage(status: number, detail: unknown, isLogin: boolean) {
  if (status === 409) return "这个邮箱已经注册过，请直接登录";
  if (status === 422) return "请检查邮箱格式，密码至少需要 6 位";
  if (status === 401) return "邮箱或密码不正确";

  if (typeof detail === "string") return detail;
  return isLogin ? "登录失败，请检查邮箱和密码" : "注册失败，请检查表单内容";
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState({
    username: "",
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("登录你的个人博客工作台");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === "login";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage(nextMode === "login" ? "登录你的个人博客工作台" : "注册后开始整理你的文章与灵感");
  };

  useEffect(() => {
    if (getAuthToken()) {
      router.replace("/wallpaper");
    }
  }, [router]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setMessage("邮箱和密码都需要填写");
      return;
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setMessage("请输入正确的邮箱格式");
      return;
    }

    if (!isLogin && form.password.length < 6) {
      setMessage("密码至少需要 6 位");
      return;
    }

    if (!isLogin && form.password !== form.confirmPassword) {
      setMessage("两次输入的密码不一致");
      return;
    }

    setIsSubmitting(true);
    setMessage(isLogin ? "正在登录..." : "正在创建账号...");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nickname: form.nickname,
          username: form.username,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(getAuthErrorMessage(response.status, errorBody?.detail, isLogin));
      }

      const session = await response.json();
      saveAuthSession(session);
      router.replace("/wallpaper");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请求失败，请确认后端服务正在运行");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="auth-background" />
      <div className="absolute inset-0 bg-gradient-to-br from-black/35 via-slate-950/25 to-amber-100/10" />
      <div className="absolute inset-0 backdrop-blur-[5px]" />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-8">
        <div className="max-h-[calc(100vh-2rem)] w-full max-w-[420px] overflow-y-auto rounded-[28px] border border-white/35 bg-white/14 px-7 py-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:px-9">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
              BlogSystem
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white">
              {isLogin ? "欢迎回来" : "创建账号"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/70">
              {message}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full border border-white/25 bg-black/18 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`h-10 rounded-full text-sm font-medium transition ${
                isLogin ? "bg-white text-slate-950 shadow-lg" : "text-white/72 hover:text-white"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`h-10 rounded-full text-sm font-medium transition ${
                !isLogin ? "bg-white text-slate-950 shadow-lg" : "text-white/72 hover:text-white"
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={submitAuth} noValidate className="space-y-3">
            {!isLogin && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-white/78">用户名</span>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="auth-input" placeholder="个人页面地址 (可选)" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-white/78">昵称</span>
                  <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} autoComplete="nickname" className="auth-input" placeholder="给自己取个名字" />
                </label>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm text-white/78">邮箱</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                autoComplete="email"
                className="auth-input"
                placeholder="name@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-white/78">密码</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={isLogin ? undefined : 6}
                  className="auth-input"
                  placeholder="输入密码"
                />
            </label>

            {!isLogin && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-white/78">确认密码</span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                  autoComplete="new-password"
                  minLength={6}
                  className="auth-input"
                  placeholder="再次输入密码"
                />
              </label>
            )}

            <div className="flex min-h-8 items-center justify-between text-sm text-white/72">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-white/30 bg-white/15 accent-white"
                />
                记住我
              </label>
              {isLogin && (
                <button type="button" className="transition hover:text-white">
                  忘记密码
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-11 w-full rounded-full bg-white text-sm font-semibold text-slate-950 shadow-xl shadow-black/25 transition hover:bg-white/90"
            >
              {isSubmitting ? "处理中..." : isLogin ? "登录" : "注册"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/70">
            {isLogin ? "还没有账号？" : "已经有账号？"}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="ml-2 font-medium text-white underline-offset-4 hover:underline"
            >
              {isLogin ? "立即注册" : "去登录"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
