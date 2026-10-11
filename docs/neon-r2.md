# Neon + Cloudflare R2 部署配置

后端已支持 Neon PostgreSQL 和 Cloudflare R2。本地开发默认继续使用 SQLite 和本地
照片目录。云端账号、数据库和存储桶需要创建后再填写环境变量；密钥不需要发送到聊天。

## 1. 创建 Neon 数据库

1. 打开 [Neon 控制台](https://console.neon.tech/)，注册或登录，创建一个项目。
2. 项目可命名为 `blogsystem`；数据库可使用默认的 `neondb`。区域尽量与 Vercel
   后端函数区域一致，减少跨区域数据库请求延迟。
3. 在项目的 **Connect** 面板选择数据库和角色，启用 **Connection pooling**。
4. 复制 PostgreSQL 连接串。连接池主机名通常带有 `-pooler`，保留 `sslmode=require`
   以及 Neon 给出的其他查询参数。直接粘贴完整连接串，不要手动拼接密码。
5. 该值填到 `DATABASE_URL`。代码会自动选用 psycopg 驱动，并使用适合事务连接池的
   设置。现有账号、文章和评论仍由 FastAPI 管理，不需要改用第三方登录。

示例（实际值来自 Neon）：

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

## 2. 创建 Cloudflare R2 存储桶和访问密钥

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，注册或登录，进入
   **R2 Object Storage**，按界面提示启用 R2。
2. 创建名为 `blogsystem-photos` 的存储桶，使用 **Standard** 存储类别。
3. 默认保留私有访问；不必启用 `r2.dev` 或购买图片域名。应用会提供有效期 5 分钟的
   图片下载地址。博客访客仍可通过公共照片 API 查看照片，私有桶不改变相册的公开属性。
4. 在 R2 的 **Manage R2 API Tokens** 创建令牌，权限选择 **Object Read & Write**，
   范围限定为这个存储桶。保存生成的 **Access Key ID** 和 **Secret Access Key**。
   普通 Cloudflare API Token 字符串不能替代这对 S3 访问密钥。
5. 从 R2 页面复制 **Account ID**，分别填写下表中的环境变量。

R2 在免费存储和请求额度内不收费，超额会按量收费。创建时以控制台展示的开通与
付款要求为准。[官方价格](https://developers.cloudflare.com/r2/pricing/)

## 3. 配置存储桶 CORS

照片通过浏览器直接上传 R2，避免大照片经过 Vercel 函数的请求体限制。即使使用
签名 URL，浏览器上传也需要存储桶允许来源域名。

在存储桶 **Settings → CORS Policy** 中粘贴 `r2-cors.example.json` 的内容，将
`https://your-project.vercel.app` 替换为实际网站地址。如果使用自定义网站域名或
预览部署，还要加入它们的完整来源地址，例如 `https://blog.example.com`。
地址只包含协议、域名和可选端口，不要包含路径或末尾斜杠。

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3100",
      "https://your-project.vercel.app"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

[Cloudflare CORS 文档](https://developers.cloudflare.com/r2/buckets/cors/)

## 4. 填写 Vercel 环境变量

打开项目 **Settings → Environment Variables**，配置下面这些变量，然后重新部署。
变量属于后端运行环境，不要添加 `NEXT_PUBLIC_` 前缀，也不要放进 `vercel.json`。

| 变量 | 值 |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | Neon 的连接池连接串 |
| `PHOTO_STORAGE` | `r2` |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `R2_BUCKET_NAME` | `blogsystem-photos`，或实际桶名 |

生产部署和预览部署都需要配置。预览环境可以使用单独的 Neon 分支和 R2 存储桶，
避免测试上传写入正式内容。浏览器 API 地址保持 `/api`，不要设置本地端口地址。
`API_PREFIX` 保持 `/api`。同域访问不需要额外配置 `CORS_ORIGINS`；存储桶 CORS
与后端 CORS 是两处不同的设置。

可选变量 `R2_PUBLIC_BASE_URL`：如果后续将 R2 桶绑定到公开的 HTTPS 自定义域名，
可以填写 `https://images.example.com`。不填写时使用私有桶签名下载地址。
不要把 S3 API endpoint 填成公共域名。

## 5. 本地测试 Neon + R2

参考 `backend/.env.neon-r2.example`，将真实值填入 `backend/.env`（已有文件请先备份）。
`.env` 及其备份文件均已忽略，不应提交到 Git。

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

另外启动前端：

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api pnpm dev
```

或者在仓库根目录通过 `vercel dev`（无需登录时用 `vercel dev -L`）一起启动。
本地后端会读取 `backend/.env`，已注入的环境变量优先于文件中的值。
本地联合测试时浏览器 API 地址保持默认 `/api`。

检查注册/登录、文章创建、中英文标签筛选和照片上传/查看/删除。R2 支持 JPEG、PNG、
WebP、GIF，单张照片最大 20 MiB。浏览器上传分为获取临时地址、直传 R2、提交照片记录
三步；数据库中只保存对象名，不保存会过期的下载链接。

如果需要纯本地开发，将 `APP_ENV=development`、`DATABASE_URL=sqlite:///./blogsystem.db`
和 `PHOTO_STORAGE=local` 恢复为 `.env.example` 中的值。

## 6. 迁移已有 SQLite 数据和照片

如果是全新网站，可以跳过这一步，后端首次启动会创建数据表。
如果要保留原来的账号、文章、评论和相册，先停止原站写入并备份 SQLite 文件和
`backend/uploads/photos` 目录。现有数据不会仅因更换 `DATABASE_URL` 自动迁移。

在 `backend/.env` 中配置目标 Neon + R2，然后先进行只读检查：

```bash
cd backend
uv run python scripts/migrate_to_neon_r2.py
```

默认只统计各表记录并验证照片文件，不会连接或写入 Neon/R2。
只有明确传入 `--apply` 才执行迁移：

```bash
uv run python scripts/migrate_to_neon_r2.py --apply
```

迁移目标应使用**新的空数据库和专用空存储桶**。脚本拒绝向已有数据的数据库写入，
保留原记录 ID、账号密码哈希、关联关系和 JSON 字段，并修正 PostgreSQL 自增序列。
本地文件照片上传至 R2；旧照片中的 Base64 data URL 会转换为 R2 对象。
原 SQLite 和照片文件不修改，表迁移失败会回滚数据库并尝试清理本次上传的对象。
如果程序被强制中断，可能需要检查并清理专用迁移桶后重试。

可用 `--sqlite /absolute/path/old.db` 和 `--photos-dir /absolute/path/photos` 指定其他源。
旧库缺少字段时，先在**备份副本**上运行本地后端进行原有 SQLite 结构升级，再迁移副本。

## 7. 本地自动化验证

```bash
cd backend
uv sync
uv run pytest -q
```

测试使用临时 SQLite 和 R2 SDK 模拟响应，不读取或修改正式数据。
实际云端连接仍需上述真实资源和环境变量完成验证。

参考：[Neon SQLAlchemy](https://neon.com/docs/guides/sqlalchemy)、
[R2 Python SDK 示例](https://developers.cloudflare.com/r2/examples/aws/boto3/)、
[Vercel 请求体限制](https://vercel.com/docs/functions/limitations)。
