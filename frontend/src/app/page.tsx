"use client";

import { useState } from "react";

type AuthMode = "login" | "register";

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const isLogin = mode === "login";

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
              {isLogin ? "登录你的个人博客工作台" : "注册后开始整理你的文章与灵感"}
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-full border border-white/25 bg-black/18 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`h-10 rounded-full text-sm font-medium transition ${
                isLogin ? "bg-white text-slate-950 shadow-lg" : "text-white/72 hover:text-white"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`h-10 rounded-full text-sm font-medium transition ${
                !isLogin ? "bg-white text-slate-950 shadow-lg" : "text-white/72 hover:text-white"
              }`}
            >
              注册
            </button>
          </div>

          <form className="space-y-3">
            {!isLogin && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-white/78">昵称</span>
                <input
                  type="text"
                  autoComplete="nickname"
                  className="auth-input"
                  placeholder="给自己取个名字"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm text-white/78">邮箱</span>
              <input
                type="email"
                autoComplete="email"
                className="auth-input"
                placeholder="name@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-white/78">密码</span>
              <input
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="auth-input"
                placeholder="输入密码"
              />
            </label>

            {!isLogin && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-white/78">确认密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
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
              className="mt-1 h-11 w-full rounded-full bg-white text-sm font-semibold text-slate-950 shadow-xl shadow-black/25 transition hover:bg-white/90"
            >
              {isLogin ? "登录" : "注册"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/70">
            {isLogin ? "还没有账号？" : "已经有账号？"}
            <button
              type="button"
              onClick={() => setMode(isLogin ? "register" : "login")}
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
