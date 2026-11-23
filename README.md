<div align="center">
  <img src="./public/brand/animatch-logo-icon.png" alt="AniMatch Logo" width="80" />

  # AniMatch

  **用一场场选择，排出属于自己的动画与动画音乐榜单。**

  动画对决 · OP / ED 音乐对决 · Tier List · 个人分享

  [开始使用](#开始使用) · [功能介绍](#功能介绍) · [本地运行](#本地运行) · [项目文档](docs/README.md)
</div>

---

## AniMatch 是什么？

AniMatch 是一个面向动画爱好者的对决与排榜网站。与其一次给几十部作品打分，你可以每次只比较两部动画或两首歌曲，逐渐整理个人喜好，并将结果生成 Tier List。

你可以浏览其他人公开的番组和音乐曲单，也可以建立自己的收藏与对决；每个人的排序进度独立保存，适合反复比较、调整榜单和分享结果。

## 功能介绍

| 场景 | 你可以做什么 |
| --- | --- |
| **动画对决** | 从公开番组开始，或自行创建番组；从 Bangumi 搜索、导入和添加作品，进行两两对决，支持平局、跳过、标记未看过、撤回与继续进度 |
| **Tier List** | 根据对决生成个人分档榜单；也可以自由拖拽封面、手动分档、保存草稿，并导出 PNG 或分享公开快照 |
| **音乐对决 / AnisongMatch** | 浏览公开曲单、查看歌曲详情和参赛范围、试听可用音源，再进行 OP / ED 等动画音乐对决；每位参与者保留自己的对决与榜单 |
| **社区与个人主页** | 查看公开榜单与社区排行，在个人主页展示已公开的番组、曲单和 Tier List，并整理年度组合与动画大赏 |

**关于个人数据：** 私人内容与公开分享由不同入口管理。公开分享采用快照，后续修改个人草稿时，已经分享的内容按其独立快照保留。

## 开始使用

下面的流程适用于已经部署好的 AniMatch 网站。浏览公开内容可以先从首页开始；登录后可以保存自己的进度。

### 排出你的动画榜单

1. 打开首页的「动画对决」，进入**番组大厅**，选择一组喜欢的动画；也可以创建自己的番组。
2. 点击「开始对决」或「继续对决」。每轮在两部动画中选择更喜欢的一部，也可以选择平局、跳过或标记未看过。
3. 在对应番组中打开个人 Tier List，查看排序结果；需要时继续对决或手动调整分档。
4. 保存个人榜单，按需导出图片或创建公开分享快照。

### 排出你的动画歌曲榜单

1. 在顶部导航打开**音乐对决**，浏览公开曲单。
2. 先点击「查看曲单」，了解歌曲、试听资源与参赛范围。
3. 点击「进入对决」，在可用歌曲中逐轮选择自己的偏好。
4. 从个人音乐曲单进入 Tier List，继续调整并分享自己的结果。

歌曲的试听可用性取决于曲单素材、音源连接状态及第三方服务条件；个人上传和分享的音频应当具有相应使用授权。

### 创建和管理自己的内容

- **创建番组：** 添加作品，设置可见范围，整理候选作品后开始个人对决。
- **创建音乐曲单：** 添加歌曲、封面和可用音源，再设置参赛范围与公开状态。
- **管理个人榜单：** 在「我的番组」「我的榜单」和「我的曲单」中继续之前的记录。
- **个人主页：** 展示自己选择公开的番组、动画榜单、音乐曲单和音乐榜单。

## 技术构成

AniMatch 使用 **Next.js 14、React 18、TypeScript、Tailwind CSS、Prisma 6 和 PostgreSQL**。支持使用 Docker Compose 运行数据库及部署服务。

| 目录 | 用途 |
| --- | --- |
| `src/app/` | 页面、路由与服务端 API |
| `src/components/` | 对决界面、编辑器与通用组件 |
| `src/lib/` | 数据、排名、权限与音频相关逻辑 |
| `prisma/` | 数据模型与迁移 |
| `tests/` | 自动化测试 |
| `docs/` | 运行、维护与历史设计资料 |

## 本地运行

**环境要求：** Node.js 22、pnpm 9、PostgreSQL 16（可以使用仓库自带的 Docker Compose）。

```bash
git clone https://github.com/Zao-c/Animatch.git
cd Animatch
corepack enable
pnpm install
docker compose up -d
cp .env.example .env.local
```

编辑 `.env.local`，配置本地 `DATABASE_URL`、`AUTH_SECRET` 以及开发所需的登录参数。仓库中的示例值仅用于指导配置，每套部署应设置独立凭据。

在**全新、空白的本地数据库**初始化表结构并启动：

```bash
pnpm exec prisma generate
DATABASE_URL='postgresql://animatch:animatch_password@localhost:5432/animatch?schema=public' pnpm exec prisma db push
pnpm dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。

> **数据库提示：** 仓库早期迁移存在顺序依赖，因此上述 `prisma db push` 仅适用于全新本地开发库。已有数据库与生产环境请按 [部署与备份指南](docs/deploy-server.md) 执行迁移和备份，保护现有数据。

常用命令：

```bash
pnpm dev                 # 本地开发
pnpm test                # Vitest 测试
pnpm lint                # ESLint 检查
pnpm exec tsc --noEmit   # TypeScript 类型检查
pnpm build               # Next.js 生产构建
```

## 部署和维护

- [服务器部署、备份与恢复](docs/deploy-server.md)
- [发布准备与正式截图规范](docs/release-prep.md)
- [全部项目文档索引](docs/README.md)

当前代码包含面向好友群的共用密码登录模式。准备面向公众开放时，请先按发布清单完成独立账号认证与权限验收，再进行公开部署。

## 数据来源、音频与许可

动画元数据使用 [Bangumi](https://bgm.tv/) 等来源；仓库还保留从 [anime-offline-database](https://github.com/manami-project/anime-offline-database) 导入数据的流程，其数据库和条目分别遵循对应的 ODbL / DbCL 条款。完整来源说明见应用内 `/data-sources` 以及 [原始许可](https://github.com/manami-project/anime-offline-database/blob/master/LICENSE)。

音乐试听、封面、用户上传素材及第三方 API 的使用须遵守对应来源的使用条件。关于音频来源及其注意事项，参见 [音乐曲单与音频共享说明](docs/anisong-shared-audio.md)。

**项目源代码使用 [MIT License](LICENSE)。** 各动画、音乐和封面素材的权利归其各自权利人所有。
