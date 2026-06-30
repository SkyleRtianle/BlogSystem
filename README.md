# BlogSystem

这是个人博客项目的基础后端环境。当前只保留最小 FastAPI 骨架，后续可以按你的指挥逐步加入文章、分类、标签、后台管理、前端页面等功能。

## 环境要求

- Python 3.12+
- uv

## 启动

```bash
uv sync
cp .env.example .env
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

访问：

- API 根路径：http://127.0.0.1:8000/
- 健康检查：http://127.0.0.1:8000/api/health
- 接口文档：http://127.0.0.1:8000/docs

## 当前结构

```text
app/
  api/          # API 路由
  core/         # 配置等核心能力
main.py         # ASGI 入口
```
