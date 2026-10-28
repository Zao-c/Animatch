<div align="center">

<img src="./public/brand/animatch-logo-icon.png" alt="AniMatch" width="80" />

# AniMatch

动画对决与 Tier List。

Next.js 14 · React 18 · TypeScript · Prisma 6 · PostgreSQL

</div>

## 功能

- **番组管理**：公开 / 私有番组，Bangumi 搜索与批量导入，按类型、年份、月份筛选；支持 TierMaker 导入、手动添加和图片上传。
- **个人对决**：左右选择、平局、跳过、没看过；候选作品可选，支持撤回、继续进度和键盘操作。
- **个人榜单**：根据对决结果生成 Tier List，可手动调整；手动分档不改写 Elo 和对决历史。
- **自由排榜**：直接拖拽封面，支持批量选择、点选分档、自定义档位和撤销。
- **保存与分享**：草稿恢复、覆盖冲突保护、PNG 导出、公开快照链接。保存草稿不会自动更新已分享的内容。
- **社区玩法**：匿名聚合榜单、赛季投票、年度组合与年度大赏；个人排序独立保存。
- **AnisongMatch**：在 `/anisong` 创建音乐曲单，按季度、OP / ED、风格筛选，自有音频批量导入或 HTTPS 直链试听，支持保存前选取试听片段、歌曲封面上传与带图榜单；对决生成 Tier List，支持撤回、手动分档、PNG 导出和不含音频的分享快照。

## 截图

使用独立本地数据库和真实登录的 `animatch_demo` 账号截取，未模拟接口响应。作品来自公开番组；截图中的选择与分档仅作界面演示。

| 首页 | 番组 |
| --- | --- |
| ![首页](docs/images/home.png) | ![番组作品墙](docs/images/pool.png) |

### 对决

![个人对决](docs/images/duel.png)

### 自由排榜

![自由排榜编辑器](docs/images/tier-list.png)

## 本地运行

需要 Node.js 22、pnpm 9 和 PostgreSQL 16。可使用 Docker 启动数据库。

```bash
corepack enable
pnpm install
docker compose up -d
cp .env.example .env.local
```

在 `.env.local` 中配置数据库连接与 `AUTH_SECRET`。本地 HTTP 使用 `AUTH_COOKIE_SECURE=false`。

**首次使用空数据库：**

```bash
pnpm exec prisma generate
DATABASE_URL='postgresql://animatch:animatch_password@localhost:5432/animatch?schema=public' pnpm exec prisma db push
pnpm dev
```

打开 [localhost:3000](http://localhost:3000)。登录页提供当前内测登录方式。

现有迁移中，`20250617000000_add_tier_config` 排在初始建表迁移之前，空库无法按序应用。上面的 `db push` 仅用于本地空库，不建立迁移历史。已有生产库按已记录的迁移升级；不要把本地初始化命令用于生产环境。

若工作区的 `.env` 指向生产配置，请勿覆盖该文件。应用开发配置使用 `.env.local`；单独执行 Prisma CLI（包括 Studio）时显式指定本地 `DATABASE_URL`，因为它默认加载 `.env`。上面的连接与仓库自带 Docker 配置一致；自建数据库请替换。

### 常用命令

```bash
pnpm dev                       # 本地开发
pnpm test                      # Vitest
pnpm lint                      # ESLint
pnpm exec tsc --noEmit          # 类型检查
pnpm build                     # 生产构建
pnpm db:studio                 # 数据库管理，需先显式指定本地 DATABASE_URL
```

## 项目结构

```text
src/app/          页面与 API
src/components/   对决、榜单与编辑组件
src/lib/          配对、计分、导入、封面与鉴权
prisma/           数据模型与迁移
scripts/          数据与运维脚本
docs/             设计、部署与变更记录
```

## 文档与部署

- [部署、备份与恢复](docs/deploy-server.md)
- [对决引擎](docs/ranking-engine-current.md)
- [对决流水与计分边界](docs/comparison-ledger.md)
- [UI / UX 问题清单](docs/ui-ux-audit-2026-10-24.md)
- [界面精简与截图记录](docs/minimal-ui-readme-2026-10-27.md)
- [AnisongMatch：功能、验证与第三方音源待办](docs/anisongmatch-2026-10-29.md)

已有生产数据库使用 `pnpm exec prisma migrate deploy` 升级；部署前按部署文档备份。

## 数据来源与许可

作品搜索与导入使用 [Bangumi](https://bgm.tv/)。本地目录也保留了从 [manami-project/anime-offline-database](https://github.com/manami-project/anime-offline-database) 导入的数据，数据库采用 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)，条目内容采用 [DbCL 1.0](https://opendatacommons.org/licenses/dbcl/1-0/)，见[原始许可](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)。应用内集中展示于 `/data-sources`。

封面、用户上传及其他导入素材的权利归各自权利人所有。项目代码采用 [MIT License](LICENSE)。
