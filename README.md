# BlogSystem

个人博客系统基础环境，采用前后端分离结构

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
- 接口文档：http://127.0.0.1:8000/docs

## 前端启动

```bash
cd frontend
pnpm install
pnpm dev
```

访问：http://localhost:3000
