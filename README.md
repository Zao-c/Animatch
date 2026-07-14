# AniMatch

AniMatch 是一个面向动画作品的两两对决与 Tier List 工具。用户可以创建番组、导入作品、通过连续对决生成自己的排序，并选择参加公开番组的社区大乱斗赛季。

普通对决和赛季对决都只维护用户自己的结果；公开番组的社区榜单会匿名聚合多位用户的个人结果，不会改写任何人的个人 Tier List。

## 当前能力

- 创建私有、未列出或公开番组，支持作品墙、番组分享和管理设置。
- 本地库搜索、Bangumi 搜索/导入、TierMaker 导入、手动添加、图片上传和批量添加作品。
- 普通两两对决：左/右胜、差不多、跳过、没看过、撤回、重开和移动端操作。
- 个人 Elo、置信度、动态配对、Tier List、手动最终排序与 SMART/RANGE/FOCUS 校准。
- 大乱斗赛季：每位用户独立赛季 Elo，完成新组合后继续提供校准对局；私心票只在社区聚合阶段产生加成。
- 社区榜单与社区 Tier List：根据匿名聚合 Elo 生成，样本不足作品单独展示，不混入正式分档。
- 公开 Tier List 快照分享和本地图片导出。
- 远程封面保护、失败降级、磁盘缓存，以及可选的腾讯 COS/CDN 按需封面缓存。

## 技术栈

- Next.js 14 App Router
- TypeScript、React 18、Tailwind CSS
- Prisma 6、PostgreSQL
- NextAuth / Friend Auth
- Vitest
- Docker Compose

## 本地启动

前提：Node.js、Corepack/pnpm、Docker Desktop。

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker compose up -d
corepack pnpm prisma generate
corepack pnpm prisma migrate dev
corepack pnpm dev
```

Windows PowerShell 复制环境文件：

```powershell
Copy-Item .env.example .env
```

打开 <http://127.0.0.1:3000>。

常用本地命令：

```bash
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm db:studio
```

## 环境变量

从 `.env.example` 或 `.env.production.example` 开始，不要提交真实 `.env` 文件。

必填或上线前必须确认的变量：

```dotenv
DATABASE_URL=postgresql://...
FRIEND_INVITE_CODE=your-invite-code
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_COOKIE_SECURE=false
SITE_ADMIN_USER_IDS=
SITE_ADMIN_CODE=
```

生成生产环境 `AUTH_SECRET`：

```bash
openssl rand -base64 32
```

HTTP 的 IP 直连部署可暂时使用 `AUTH_COOKIE_SECURE=false`；接入 HTTPS 后必须设为 `true` 并重新构建应用。

## 生产部署

完整说明见 [docs/deploy-server.md](docs/deploy-server.md)。生产环境只使用 `prisma migrate deploy`，不要执行 `prisma migrate dev`。

典型更新流程：

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build app
curl -fsS http://127.0.0.1:3000/api/health
```

当前服务器维护约定：仓库位于 `/opt/Animatch/animatch`，通过 `ssh root@182.61.136.105` 登录。日常更新只重建 `app` 服务，不重启 PostgreSQL 或代理服务。

上线前建议至少执行：

```bash
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

部署后检查 `/api/health`，并使用无缓存浏览器验证登录、普通对决、赛季对决、Tier List 和封面加载。

## 腾讯 COS / CDN 封面缓存（可选）

AniMatch 只缓存已经进入番组的去重作品封面，不会把整个动画库上传到 COS。

```dotenv
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=example-1234567890
COS_REGION=ap-shanghai
COS_PUBLIC_BASE_URL=https://example-1234567890.cos.ap-shanghai.myqcloud.com
NEXT_PUBLIC_COS_PUBLIC_BASE_URL=https://img.example.com
NEXT_PUBLIC_DIRECT_IMAGE_HOSTS=img.example.com,example-1234567890.cos.ap-shanghai.myqcloud.com
COS_COVER_PREFIX=animatch/covers
COS_OBJECT_ACL=public-read
```

- COS 密钥只能保留在服务器环境变量中，绝不能暴露到浏览器或提交到仓库。
- 浏览器可直接访问的 COS/CDN 域名放入 `NEXT_PUBLIC_DIRECT_IMAGE_HOSTS`；其他远程封面仍会走受限的 `/api/image-proxy`。
- 修改 `NEXT_PUBLIC_*` 图片域名变量后需要重新构建应用。
- 已在番组中的旧封面可在服务器执行：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app pnpm covers:cache-cos
```

反复执行直到输出中的 `usedPendingAnimeCount` 和 `usedStaleAnimeCount` 都为 `0`。详细 CORS、回填和故障排查见 [部署文档](docs/deploy-server.md#optional-tencent-cos-cover-cache)。

## 计分与数据边界

### 普通对决

- 每个分数严格属于 `userId + poolId + runId + animeId`，不会污染其他用户或其他轮次。
- 有效结果为左胜、右胜、平局；它们在数据库事务中更新 Elo 和对局流水。
- 跳过不改 Elo；没看过会更新个人状态，并从后续候选中隐藏，不会进入个人 Tier List。
- 配对优先考虑未充分比较、Elo 接近、排序边界附近和低置信度作品，同时避免近期重复组合。
- 手动 Tier 只影响最终展示，不会篡改 Elo 或对决历史。

### 大乱斗赛季

- 每个参与者在该赛季中拥有独立的作品 Elo、比较次数和隐藏状态。
- 覆盖新组合后，系统会继续发放高价值重复对局，让更多票数用于稳定个人偏好，而不是提前耗尽候选。
- 私心票不会放大个人 Elo；它只在最终社区聚合时提升该用户对对应作品的贡献权重。
- 共享榜单按个人赛季 Elo 聚合，并保留样本门槛，避免单人少量投票直接成为正式社区排名。

## 文档

- [部署与备份](docs/deploy-server.md)
- [好友内测准备](docs/playtest-readiness.md)
- [当前普通对决引擎](docs/ranking-engine-current.md)
- [排名引擎 v2 方向](docs/ranking-engine-v2.md)
- [对决流水说明](docs/comparison-ledger.md)
- [UI 优化路线](docs/animematch-ui-optimization-roadmap.md)

## API 与健康检查

健康检查：

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

API 使用统一响应外层：

```json
{ "ok": true, "data": {} }
```

```json
{ "ok": false, "error": { "message": "error message" } }
```

路由实现位于 `src/app/api`。优先使用网页界面或已有客户端 API，不要从浏览器直接请求 Bangumi，也不要把 Elo、胜负后分数或其他排名结果作为客户端写入参数。

## 备份与安全

内测前先执行：

```bash
./scripts/backup-postgres.sh
```

备份会写入 `backups/`，该目录已被 git 忽略。恢复演练应在测试环境完成。

不要在生产环境执行：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

`-v` 会删除 PostgreSQL 数据卷。
