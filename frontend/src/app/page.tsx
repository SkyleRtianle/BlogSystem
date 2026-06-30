export default function Home() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          BlogSystem
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
          个人博客正在从这里开始。
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          前端基础环境已接入 Next.js 和 Tailwind CSS。接下来可以按模块逐步构建首页、文章列表、详情页和后台接口。
        </p>
      </section>
    </main>
  );
}
