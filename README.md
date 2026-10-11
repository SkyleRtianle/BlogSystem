# BlogSystem

个人博客系统基础环境，采用前后端分离结构。

## 技术栈

- 后端：FastAPI + SQLModel
- 前端：Next.js + Tailwind CSS
- Python 包管理：uv
- Node 包管理：pnpm

## 项目结构

```text
backend/        # FastAPI + SQLModel
frontend/       # Next.js + Tailwind CSS
```

## 后端启动

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

访问：

- API 根路径：http://127.0.0.1:8000/
- 健康检查：http://127.0.0.1:8000/api/health
- 接口文档：http://127.0.0.1:8000/api/docs

## 前端启动

```bash
cd frontend
pnpm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api pnpm dev
```

访问：http://localhost:3000

## Vercel 多服务部署

在 Vercel 中导入整个仓库，项目的 Root Directory 保持为仓库根目录（不要设为
`frontend` 或 `backend`）。根目录的 `vercel.json` 定义两个独立构建的服务：

| 服务 | 目录 / 框架 | 公共路径 |
| --- | --- | --- |
| `backend` | `backend` / FastAPI，入口 `main:app` | `/api/*` |
| `frontend` | `frontend` / Next.js | 其他路径，包括 `/` |

Vercel 保留请求路径，因此后端路由继续使用 `/api` 前缀；不要在部署环境中把
`API_PREFIX` 改成其他值。健康检查为 `/api/health`，文档为 `/api/docs`，
OpenAPI 为 `/api/openapi.json`。API 文档也在公共 API 路径内。

所有现有 API 请求都由浏览器发起，默认使用同源 `/api`，包括图片和音乐请求。
Vercel 环境中应移除已有的 `NEXT_PUBLIC_API_BASE_URL` 本地地址覆盖（或设为 `/api`）。
本地独立运行前后端时才使用上面的绝对地址；`./start.sh` 会自动设置本地地址。

目前没有函数在服务之间发起请求，因此没有声明 `bindings`，也没有内部专用服务。
浏览器不能读取内部绑定 URL。以后如果增加后端之间或 Next.js 服务端到 FastAPI
的调用，应在调用方声明包含 `type`、`service`、`format`、`env` 四个字段的绑定，
并在运行时函数中读取注入变量；不要手动设置该变量，也不要在构建或 middleware
中读取它。

### 部署前的存储前提

目前 `DATABASE_URL` 默认指向本地 SQLite，照片上传写入 `backend/uploads/photos`。
这些本地文件不适合作为 Vercel Functions 的持久存储。正式部署前需要配置托管数据库
的 `DATABASE_URL`、添加对应数据库驱动，并将照片上传/读取/删除迁移到持久对象存储。
不能仅将 SQLite 或照片目录搬到 `/tmp`，因为实例之间不共享这些数据。
此配置只完成服务和路由接入；数据库和照片存储供应商仍需选择和配置。

### 本地验证

安装支持 Services 的 Vercel CLI，然后在仓库根目录运行：

```bash
vercel dev
```

也可以使用 `vercel dev -L` 进行无需云端登录的本地验证。使用该方式时不要设置
`NEXT_PUBLIC_API_BASE_URL` 的本地端口覆盖，以便验证同域路由。
检查 `/`、`/api/health`、`/api/docs` 和 `/api/openapi.json`，再验证登录、文章、
照片和音乐请求。CLI 会为以后声明的服务绑定自动注入变量。

参考：[Services](https://vercel.com/docs/services)、
[Service bindings](https://vercel.com/docs/services/bindings)。
