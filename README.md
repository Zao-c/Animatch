<div align="center">
  <img src="./public/brand/animatch-logo-icon.png" alt="AniMatch Logo" width="84" />

  # AniMatch

  **别再纠结“给 8 分还是 9 分”了——两两摆在眼前，靠直觉点出更喜欢的那一边，剩下的交给 Elo。**

  番剧 & 角色二选一对决 · OP/ED 听歌排榜 · 自动生成 Tier List · 社区共识 & 年度大赏

  [在线体验](https://animatch.sparrowland.xyz) · [核心玩法](#-怎么玩三步上头) · [更多脑洞模式](#-不止个人排榜还能这么玩) · [本地跑起来](#-本地跑起来) · [文档索引](docs/README.md)
</div>

---

<p align="center">
  <img src="./docs/images/home.png" alt="AniMatch 首页：即点即玩对决台与热门番组电影墙" width="100%" />
</p>

## 🤔 这玩意到底玩什么？

每次想给《四月新番》《原神全角色》或者《最爱的动画 OP》排个榜，打开传统 TierMaker 面对几十上百个头像直接大脑宕机：*“这俩到底谁放 S 谁放 A？”*

**AniMatch 把这件事拆成了人类最擅长的动作——二选一。**
你只需要回答一个个简单问题：**“这两部，你更偏爱哪边？”**
点上十几轮，Elo 引擎就会自动把它们排进 `S / A / B / C / D` 墙体里，越比越准，完全不用手动打分。

---

## 🎮 怎么玩？三步上头

### 1. 选一个池子开局，或者自己组局
不想自己找图？直接去**番组大厅**挑大家建好的池子（新番季度榜、二次元手游角色、甚至冷门个人安利池）；想自己攒一局，支持从 **Bangumi 搜索**、**TierMaker 链接一键导入**，或直接拖进本地图片开池。

<p align="center">
  <img src="./docs/images/pool.png" alt="公开番组大厅与错落封面拼贴墙" width="100%" />
</p>

---

### 2. 海报直选，直觉二选一（还支持键盘盲操）
两张高清海报铺开在面前：**点海报就能投票**，也支持键盘快捷键（`←` 左 / `→` 右 / `↑` 差不多平局 / `↓` 跳过 / `1`-`4`）。没看过的直接标“没看过”踢出本轮，选错了随时撤回。

<p align="center">
  <img src="./docs/images/duel.png" alt="AniMatch 海报焦点化二选一对决页" width="100%" />
</p>

---

### 3. 自动成榜 + 手拽微调 + 一键出图对线
对决几轮随时切到 **Tier List 墙**，看你的本命们如何排排坐。要是某部作品差了一口气？切到编辑模式**直接拖进想要的档位**，最后导出一张完整的高清长图或生成永久公开快照链接，发给群友“锐评”。

<p align="center">
  <img src="./docs/images/tier-list.png" alt="自动生成且支持拖拽微调的 Tier List 墙" width="100%" />
</p>

---

## 🔥 不止个人排榜，还能这么玩

### 🎧 AnisongMatch · 听歌二选一
光看封面不过瘾？切到**音乐对决**——支持 30 秒歌曲试听（公共音源池 + iTunes + 网易云匹配），用耳朵给《2026 动画 OP/ED》《ヨルシカ》《轨迹燃曲》排座次。

<p align="center">
  <img src="./docs/images/anisong.png" alt="AnisongMatch 动画音乐曲单详情与试听" width="100%" />
</p>

### ✨ 还有这些隐藏玩法
- **社区共识榜 & 口味雷达**：把匿名对决汇进公开池的「社区平均 Tier」，看看大家的公认神作是谁，再和好友测测“口味相似度 / 分歧榜”。
- **开播 vs 完结对照（年度组合）**：把春/夏/秋/冬四季的开播初印象与完结真实口碑拼在一起，一目了然谁“低开高走”、谁“晚节不保”，年底还能合并来一场**年度总决选**。
- **年度动画大赏（Ceremony）**：和朋友一起提名、投票，用直播大屏模式（Screen / Host / Live）揭晓你们小圈子的年度最佳。

---

## 🛠 技术构成

基于 **Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Prisma 6 · PostgreSQL 16** 构建，支持 Docker Compose 一键部署。

<details>
<summary>查看仓库目录结构</summary>

| 目录 | 说明 |
| --- | --- |
| `src/app/` | Next.js 页面路由与服务端 API |
| `src/components/` | 对决舞台、Tier 编辑器、音乐播放器与通用 UI 原语 |
| `src/lib/` | Elo 排序收敛、权限控制、封面缓存与音频服务逻辑 |
| `prisma/` | 数据模型与迁移脚本 |
| `tests/` | Vitest 自动化测试（214 个测试套件 / 1861 个用例） |
| `docs/` | 部署、迁移与架构设计文档索引 |

</details>

---

## 🚀 本地跑起来

需要 **Node.js 22**、**pnpm 9**、**PostgreSQL 16**（仓库内置 `docker-compose.yml`）：

```bash
git clone https://github.com/Zao-c/Animatch.git
cd Animatch
corepack enable
pnpm install
docker compose up -d
cp .env.example .env.local
```

按需修改 `.env.local` 里的 `DATABASE_URL`、`AUTH_SECRET` 等配置后，初始化空白开发库并启动：

```bash
pnpm exec prisma generate
DATABASE_URL='postgresql://animatch:animatch_password@localhost:5432/animatch?schema=public' pnpm exec prisma db push
pnpm dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可。

> **数据库提示：** 生产环境或已有数据库的迁移与备份请严格参考 [服务器部署与备份指南](docs/deploy-server.md)。

常用开发命令：

```bash
pnpm dev                 # 本地开发
pnpm test                # 运行 Vitest 测试
pnpm lint                # ESLint 检查
pnpm exec tsc --noEmit   # TypeScript 类型检查
pnpm build               # 生产构建
```

---

## 📚 更多文档 & 许可

- [服务器部署、备份与恢复](docs/deploy-server.md) · [发布清单](docs/release-prep.md) · [全部文档索引](docs/README.md)
- 动画元数据源自 [Bangumi](https://bgm.tv/) 及 [anime-offline-database](https://github.com/manami-project/anime-offline-database)（遵循对应 ODbL / DbCL 条款，详见应用内 `/data-sources`）。
- 音频试听与共享素材须遵守各自来源条款，详见 [音乐曲单与音频共享说明](docs/anisong-shared-audio.md)。
- **源代码基于 [MIT License](LICENSE) 开源**；动画、音乐与封面素材版权归原权利方所有。
