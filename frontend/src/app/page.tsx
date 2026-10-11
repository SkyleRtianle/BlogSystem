
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, saveAuthSession } from "@/lib/auth";

type AuthMode = "login" | "register";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
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
        <div className={`auth-shell ${isLogin ? "is-login" : "is-register"}`}>
          <div className="auth-mobile-tabs">
            <button type="button" onClick={() => switchMode("login")} className={isLogin ? "is-active" : ""}>
              登录
            </button>
            <button type="button" onClick={() => switchMode("register")} className={!isLogin ? "is-active" : ""}>
              注册
            </button>
          </div>

          <div className="auth-panel auth-panel-login" inert={!isLogin} aria-hidden={!isLogin}>
            <AuthHeader title="欢迎回来" message={message} />
            <form onSubmit={submitAuth} noValidate className="space-y-3">
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
                  autoComplete="current-password"
                  className="auth-input"
                  placeholder="输入密码"
                />
              </label>

              <div className="flex min-h-8 items-center justify-between text-sm text-white/72">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-white/30 bg-white/15 accent-white"
                  />
                  记住我
                </label>
                <button type="button" className="transition hover:text-white">
                  忘记密码
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !isLogin}
                className="auth-submit"
              >
                {isSubmitting && isLogin ? "处理中..." : "登录"}
              </button>
            </form>
          </div>

          <div className="auth-panel auth-panel-register" inert={isLogin} aria-hidden={isLogin}>
            <AuthHeader title="创建账号" message={message} />
            <form onSubmit={submitAuth} noValidate className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-white/78">用户名</span>
                <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="auth-input" placeholder="个人页面地址 (可选)" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-white/78">昵称</span>
                <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} autoComplete="nickname" className="auth-input" placeholder="给自己取个名字" />
              </label>

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
                  autoComplete="new-password"
                  minLength={6}
                  className="auth-input"
                  placeholder="输入密码"
                />
              </label>

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

              <button
                type="submit"
                disabled={isSubmitting || isLogin}
                className="auth-submit"
              >
                {isSubmitting && !isLogin ? "处理中..." : "注册"}
              </button>
            </form>
          </div>

          <div className="auth-slider" aria-hidden="true">
            <div className="auth-slider-content auth-slider-login">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/72">BlogSystem</p>
              <h2>开始写作</h2>
              <p>还没有账号？注册后整理你的文章、照片与灵感。</p>
            </div>
            <div className="auth-slider-content auth-slider-register">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/72">BlogSystem</p>
              <h2>欢迎回来</h2>
              <p>已经有账号了，回到你的个人博客工作台。</p>
            </div>
          </div>

          <div className="auth-slider-actions">
            <button type="button" onClick={() => switchMode(isLogin ? "register" : "login")}>
              {isLogin ? "立即注册" : "去登录"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthHeader({ title, message }: { title: string; message: string }) {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
        BlogSystem
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {message}
      </p>
    </div>
  );
}
