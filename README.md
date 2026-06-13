# AniMatch

AniMatch 是一个动画两两对决与个人 Tier List 网站。当前仓库只建设长期数据地基、Bangumi 代理缓存、Custom Pool 基础 API、算法工具函数和工程规则，不实现复杂 UI、个人 Match 页面、社区赛季或 Live 房间。

## 技术栈

- Next.js 14 App Router
- TypeScript
- Prisma
- PostgreSQL
- Tailwind CSS
- NextAuth 预留结构
- pnpm

## 本地开发启动

新开发者 clone 项目后，可以用 Docker 一键启动 PostgreSQL：

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm dev
```

然后打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

Windows PowerShell 下复制 `.env`：

```powershell
Copy-Item .env.example .env

Friend Auth uses these local environment variables:

- `FRIEND_INVITE_CODE=33989` for the friend invite code.
- `AUTH_SECRET=replace-with-long-random-secret` for signing login cookies.
- `AUTH_COOKIE_SECURE=false` for bare HTTP deployments. Set it to `true` after moving the site to HTTPS.

For production, generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```
```

也可以使用脚本：

```bash
pnpm db:up
pnpm dev:setup
pnpm dev
```

## 生产部署

生产部署使用 `docker-compose.prod.yml` 同时运行 Next.js 应用和 PostgreSQL。服务器部署步骤见 [docs/deploy-server.md](docs/deploy-server.md)。

## AniMatch 数据边界

- `Anime` 是公共动画元数据，只保存 Bangumi 等来源的作品资料，不保存任何用户评分。
- `CustomPool` 是用户创建或克隆的一组动画集合，本身不代表个人偏好。
- `PoolAnime` 是 pool 和 anime 的 membership 表，保存池内位置、备注和初始 Elo。
- `PersonalRun` 是用户在某个 `CustomPool` 下的一次个人测评版本。
- `UserPoolScore` 是 `userId + poolId + runId + animeId` 下的当前评分状态。
- `PoolComparison` 是每一次两两对决的历史账本，只追加，不覆盖。
- `UserAnimeStatus` 是用户对某部动画的长期观看或兴趣状态，不等同于 Elo。
- `ManualTierAdjustment` 记录手动 Tier 修正历史，最终展示可受手动字段影响，但 Elo 历史不被覆盖。

## 15 条不可变规则

1. 所有个人 Elo 必须属于 `userId + poolId + runId + animeId`。
2. `Anime` 表只存公共元数据，不存任何用户分数。
3. `UserPoolScore` 是 current state，`PoolComparison` 是 append-only ledger。
4. 前端永远不能提交 Elo 分数，只能提交选择结果。
5. Elo 更新必须在后端数据库事务中完成。
6. 每次有效投票必须写入 `PoolComparison`，并更新双方 `UserPoolScore`。
7. `SKIP`、`LEFT_UNSEEN`、`RIGHT_UNSEEN`、`BOTH_UNSEEN` 不改变 Elo。
8. 手动 Tier 不覆盖 Elo，只通过 `manualTier`、`manualRank`、`manualLocked` 控制最终展示。
9. 所有写接口必须支持 `clientMutationId`，避免重复提交。
10. 分享内容必须有 `visibility`，重要资源必须有 `status` 或 `deletedAt`。
11. Bangumi 只通过后端代理访问，客户端不直接调用 Bangumi。
12. `rawJson` 和 `fetchedAt` 必须保留，用于追踪外部数据来源和刷新时间。
13. `bgmId` 只能作为外部唯一 ID，不能作为 `Anime` 主键。
14. 生产环境只使用 `prisma migrate deploy`，不使用开发迁移命令改生产库。
15. 必须做每日备份并定期恢复演练；算法版本必须落库，包括 `algorithmVersion`、`pairingVersion`、`tierRuleVersion`。

## Elo-v1 规则

- `initialElo = 1500`
- `initialUncertainty = 350`
- `minUncertainty = 80`
- 期望分使用标准 Elo 公式：`1 / (1 + 10 ^ ((ratingB - ratingA) / 400))`
- K 因子：
  - `compareCount < 10`：base K = 40
  - `compareCount < 30`：base K = 24
  - 其他：base K = 16
  - `uncertaintyBoost = clamp(uncertainty / 250, 0.75, 1.5)`
  - `K = base * uncertaintyBoost`
- `LEFT_WIN`：左侧得分 1，右侧得分 0。
- `RIGHT_WIN`：左侧得分 0，右侧得分 1。
- `DRAW`：双方得分 0.5。
- `SKIP` 和 `UNSEEN` 类结果不改 Elo，只记录状态或计数。
- Elo 更新保留小数，不强制四舍五入。

## Tier-v1 规则

- Tier 类型为 `S | A | B | C | D`。
- `manualLocked=true` 且 `manualTier` 有效时，优先进入手动 tier。
- 非手动锁定项目按 `eloScore` 降序后按百分位分配：
  - S：top 10%
  - A：10%-30%
  - B：30%-60%
  - C：60%-85%
  - D：bottom 15%
- 每个 tier 内部排序：
  - 手动项目按 `manualRank` 升序。
  - 自动项目按 `eloScore` 降序。
- 手动 Tier 只影响最终展示，不改写 Elo 或 `PoolComparison`。

## Pairing active-v1 规则

- 冷启动期优先选择未比较过、Elo 接近、不确定性高、比较次数少的 pair。
- 稳定期继续偏向 Elo 接近和同 tier 的 pair，减少重复比较。
- 校准期可通过 `PoolComparisonMode` 使用 `RECALIBRATE`、`FOCUS_RECALIBRATE`、`RANGE_RECALIBRATE` 标记来源。
- 最近比较过的 pair 直接排除，避免短时间重复。
- 隐藏项目不进入候选 pair。
- 候选 pair 取优先级最高的前 20 个，再随机取一个，避免路径完全固定。
- `pairKey` 由排序后的两个 `animeId` 用 `:` 拼接，保证 A:B 与 B:A 指向同一 pair。

## Phase 2：Bangumi 代理与缓存

- 前端不能直接大量请求 Bangumi，搜索和导入都走 `/api/anime/*` 后端 API。
- `src/lib/bangumi.ts` 负责 Bangumi 请求、非 2xx 错误处理、`User-Agent` 设置和数据标准化。
- `src/lib/anime-service.ts` 负责把标准化后的 Bangumi subject upsert 到 `Anime`。
- `Anime` 表是按需缓存，不是全量爬取。
- `bgmId` 是 Bangumi 外部唯一 ID，`Anime.id` 仍然是内部主键。
- `rawJson` 和 `fetchedAt` 会落库，用于后续刷新、排查和字段迁移。
- API 返回给前端的 Anime 字段不包含 `rawJson`。
- `CustomPool` 只是作品集合，不存评分；评分仍然属于 `PersonalRun` 和 `UserPoolScore`。
- 当前 Pool API 使用 `dev@animatch.local` 临时开发用户，正式登录系统会替换为 NextAuth。

## Phase 3：个人 Match 核心闭环

- 使用 `POST /api/pools/[poolId]/runs/default` 为某个 pool 创建或获取默认 `PersonalRun`。
- 创建默认 run 后会初始化该 run 下的 `UserPoolScore`，每个分数严格属于 `userId + poolId + runId + animeId`。
- 使用 `GET /api/pools/[poolId]/runs/[runId]/match-queue?limit=8` 获取对决队列。
- Queue 一次返回 6-10 组 pair，前端可以提前加载左右动画图片，减少连续投票时的等待。
- `pairId` 只是前端队列标识，后端提交时只信任 `leftAnimeId`、`rightAnimeId`、`result` 和 `clientMutationId`。
- 提交投票使用 `POST /api/pools/[poolId]/runs/[runId]/comparisons`。
- 前端只提交 `result`，不能提交 Elo、胜负后分数或任何排名数值。
- Elo 更新由后端在 Prisma 事务中完成，事务内同时写入 `PoolComparison` 并更新双方 `UserPoolScore`。
- `PoolComparison` 是 append-only 历史账本，`UserPoolScore` 是当前状态。
- `clientMutationId` 用于防重复提交；同一个用户重复提交同一个 ID 会返回已有 comparison 和当前 scores。
- `SKIP`、`LEFT_UNSEEN`、`RIGHT_UNSEEN`、`BOTH_UNSEEN` 不改变 Elo，也不增加 `compareCount`。
- `UNSEEN` 会更新 `UserAnimeStatus`，`source="MATCH"`，后续可用于推荐、隐藏和冷启动判断。
- 当前 Tier List 来自 `UserPoolScore` 的当前状态，通过 `GET /api/pools/[poolId]/runs/[runId]/tierlist` 获取。
- 手动 Tier 字段保留但本阶段不实现拖拽调整 API。

## Phase 4：前端 MVP 与图片预加载

- 访问 `/pools/new` 创建番组，当前仍使用 `dev@animatch.local` 临时用户。
- 在 `/pools/[poolId]` 搜索 Bangumi 动画并加入番组，或粘贴 Bangumi ID / subject 链接批量导入。
- 点击“开始对决”会创建或进入默认 run，然后跳转到 Match 页面。
- Match 页面通过 `/match-queue?limit=8` 一次获取 8 组 pair，保持 6-10 组的短队列。
- 开局先显示 `LoadingRoom`，等待首组和后续几组封面预加载完成或失败后进入对决。
- 后续队列少于 3 组时，前端后台拉取下一批 pair 并预加载图片，避免连续点击时卡顿。
- 图片加载失败不会阻塞选择，`AnimeCover` 会显示标题占位卡。
- 前端永远不计算 Elo，只提交 `leftAnimeId`、`rightAnimeId`、`result` 和 `clientMutationId`。
- Tier List 页面从后端 `UserPoolScore` 构建，只展示当前状态，不实现拖拽。

## Phase 5：手动最终设定与校准模式

- Elo 是系统根据对决历史推断出的分数，`manualTier` 是用户对最终榜单的显式声明。
- 手动拖拽只更新 `UserPoolScore.manualTier`、`manualRank`、`manualLocked`，不会修改 Elo，也不会删除 `PoolComparison`。
- 每次保存手动最终设定都会写入 `ManualTierAdjustment`，记录调整前后的 tier/rank 和当时 Elo。
- 用户可以点击“恢复系统排序”清空手动锁定，回到 Elo 百分位生成的系统排序。
- 校准模式不是重置榜单，而是在当前 run 上补关键对决。
- 校准 pairing 优先选择 Elo 接近、同 Tier、排名相邻、比较次数低、不确定性高、未直接比较过的组合。
- RANGE 校准关注目标 tier 及相邻边界，FOCUS 校准围绕 1-3 个目标动画，SMART 校准做全局选择。
- 校准产生的 `PoolComparison` 通过 `mode` 区分：`RECALIBRATE`、`FOCUS_RECALIBRATE`、`RANGE_RECALIBRATE`。
- `RecalibrationSession` 记录 `plannedCount`、`completedCount`、类型、目标 tier 和目标动画。
- 校准提交仍然只提交选择结果，不提交 Elo；SKIP/UNSEEN 仍然不改变 Elo。

## API 列表

- `GET /api/health`
- `GET /api/anime/search?q=xxx&limit=20`
- `GET /api/anime/[bgmId]`
- `POST /api/anime/bulk-import`
- `GET /api/pools`
- `POST /api/pools`
- `GET /api/pools/[poolId]`
- `POST /api/pools/[poolId]/anime`
- `POST /api/pools/[poolId]/anime/bulk-import`
- `DELETE /api/pools/[poolId]/anime/[animeId]`
- `GET /api/pools/[poolId]/runs`
- `POST /api/pools/[poolId]/runs/default`
- `GET /api/pools/[poolId]/runs/[runId]/match-queue?limit=8`
- `POST /api/pools/[poolId]/runs/[runId]/comparisons`
- `GET /api/pools/[poolId]/runs/[runId]/tierlist`
- `PATCH /api/pools/[poolId]/runs/[runId]/manual-tier`
- `DELETE /api/pools/[poolId]/runs/[runId]/manual-tier`
- `GET /api/pools/[poolId]/runs/[runId]/recalibration/suggestions`
- `POST /api/pools/[poolId]/runs/[runId]/recalibration`
- `GET /api/pools/[poolId]/runs/[runId]/recalibration/[sessionId]/next-pair`

所有 API 尽量使用统一响应：

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "message": "error message"
  }
}
```

## Custom Pool API 示例

创建 pool：

```bash
curl -X POST http://localhost:3000/api/pools \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"2024 动画池\",\"visibility\":\"PRIVATE\",\"tags\":[\"seasonal\"]}"
```

通过 Bangumi ID 添加动画：

```bash
curl -X POST http://localhost:3000/api/pools/{poolId}/anime \
  -H "Content-Type: application/json" \
  -d "{\"bgmId\":876}"
```

批量导入到 pool：

```bash
curl -X POST http://localhost:3000/api/pools/{poolId}/anime/bulk-import \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"876, 877\nhttps://bgm.tv/subject/878\"}"
```

## 后续阶段规划

Phase 1:

- Prisma schema
- Bangumi 代理
- CustomPool
- PersonalRun
- 个人 match
- Tier List
- 校准模式
- 手动 Tier

Phase 2:

- 玩家相似度
- 推荐系统
- 番剧详情页
- 公开主页

Phase 3:

- 社区赛季

Phase 4:

- Live PK 房间

## 本轮未实现但已预留

- NextAuth OAuth provider 尚未接入，`src/lib/auth.ts` 只保留配置位置。
- Bangumi 数据刷新策略、限流和后台任务尚未实现。
- 个人 Match 页面尚未实现，本轮只实现后端闭环 API。
- 手动 Tier 已支持桌面拖拽保存，移动端拖拽体验后续可继续优化。
- 推荐和相似度只建立数据模型，尚未实现计算任务。
- 社区赛季和 Live PK 房间没有建表，只在路线图中保留。

## 常见错误

### DATABASE_URL not found

通常是没有 `.env`，或 Next.js/Prisma 没有加载环境变量。

修复：

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

### Can't reach database server

通常是 Docker PostgreSQL 没启动。

修复：

```bash
docker compose up -d
```

或：

```bash
pnpm db:up
```

### Prisma schema changed but DB not migrated

Prisma schema 已改变，但本地数据库还没应用迁移。

修复：

```bash
pnpm prisma migrate dev
```

或：

```bash
pnpm db:migrate
```

## 如何运行测试

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm test
```

本地数据库连接从 `.env` 的 `DATABASE_URL` 读取。可以复制 `.env.example` 作为本地配置起点。
