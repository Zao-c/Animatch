# 给 AniMatch 服务器 AI 的任务书（请从这里开始）

请按此文档帮助仓库所有者准备 Git 历史精简。**当前只做读取、备份、测试和独立分支准备。生产站点持续正常运行，正式 main 保持现状。**

仓库：`https://github.com/Zao-c/Animatch`

## 目标与当前事实

- 原始 `main`：`68aee4df118acb8d4c3e97966f05d5f70a23c33c`，约 493 个可达 Commit。
- 历史备份：`backup/main-full-history-20261123`，同一原始 SHA。
- 8 个 Commit 预览：`preview/main-release-milestones-20261123`，SHA `3e26bf2746908b2b5b75270a8252c8040c93491a`。
- 两个版本最终 Git Tree：`7e890ff74691dba21747119e2e3710c8cbcf91ad`。
- 仍需保留并评估：PR [#1](https://github.com/Zao-c/Animatch/pull/1)、[#23](https://github.com/Zao-c/Animatch/pull/23)、[#33](https://github.com/Zao-c/Animatch/pull/33)。PR #33 的音频共享授权行为须保持用户原定规则：**修改曲单后继续沿用已勾选授权，不增加自动重新确认。**
- 当前仓库部署文档 `docs/deploy-server.md` 使用 `git pull` 更新源代码。主分支历史切换后，服务器需实施单独设计的工作区迁移流程。

以上是 2026-11-23 已查状态。**在执行任何步骤前重新核对 GitHub 最新状态。**

## 现在执行的工作

### 第 1 步：只读服务器现场检查

读取服务器真实运行的部署目录（由现有配置、systemd 或 Docker Compose 定位）并记录以下信息：

```bash
pwd
git status --porcelain=v1
git rev-parse HEAD
git branch --show-current
git show -s --format='%H %cI %s' HEAD
git worktree list
git remote -v
docker compose -f docker-compose.prod.yml ps
```

若服务器使用不同 Compose 路径或部署方案，按实际配置核对。日志和反馈中**脱敏**数据库连接串、口令、URL Token、Cookie、个人账户信息和云存储凭据。检查服务器空余磁盘、备份保存位置、运行容器、上传文件和音频持久化目录。只采集状态，保留生产进程及数据。

### 第 2 步：核对 GitHub 引用和提交内容

```bash
git fetch origin main backup/main-full-history-20261123 preview/main-release-milestones-20261123
git rev-parse origin/main
git rev-parse origin/backup/main-full-history-20261123
git rev-parse origin/preview/main-release-milestones-20261123
git rev-parse 'origin/main^{tree}'
git rev-parse 'origin/preview/main-release-milestones-20261123^{tree}'
git diff --quiet origin/main origin/preview/main-release-milestones-20261123
```

如果 SHA 或 Tree 有变化，**停止旧版 493→8 历史切换计划并说明差异**；重新规划新的终点快照。

### 第 3 步：执行离线 Git 备份和核验

打开本目录 `preflight_and_full_backup.sh`。在有 GitHub 访问权限、空余磁盘足够且备份路径独立的机器上执行：

```bash
bash ops/history-rewrite/preflight_and_full_backup.sh /path/to/separate-backup-disk/animatch-git-history
```

执行结束后，核验目录包含 Git Mirror、`.bundle`、`.sha256`、全部引用快照、提交清单和恢复说明，记录校验结果。**备份本身只读取 GitHub，文件生成在本地备份目录。** Git Bundle 不包含 PostgreSQL、图片、音频以及 GitHub PR/Issue 评论和仓库设置，需单独清点这些数据的备份。

### 第 4 步：在隔离环境验证预览分支

使用与生产环境分离的工作区（可以使用第二次 clone 或 `git worktree`）。在该目录运行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

按照现有 CI 版本（Node 20、pnpm 9.15.0）准备环境；涉及数据库的真实联调在独立测试库执行。记录每一步结果、测试数量、错误信息和任何环境阻碍。预览分支自身目前未配置自动 push CI，需要明确记录手工测试结果。

### 第 5 步：评估三个 Open PR

- **#33 音乐修复：** 优先考虑把其单一修复 Commit 移植到预览分支的另一条独立测试分支；核对服务端参与者权限、错误恢复、音频共享授权原有行为；运行 CI/真实数据库测试。现在保留原 PR 供回溯。
- **#23 番组协作和社区排行：** 先审查权限模型和冲突，在新基线上只移植实际有价值的功能差异，使用独立 PR。
- **#1 早期 preload 修复：** 评估是否已经由现有代码覆盖，若仍需要则在最新代码上重做小补丁。

任何代码移植均应建立新开发分支和新 PR，提供差异与测试记录。**当前请不要把它们合并进 main。**

### 第 6 步：交付报告

请向仓库所有者提交：

1. 生产实际部署的 Git SHA/分支、工作区状态、部署方式与持久数据路径（敏感内容脱敏）；
2. 三个 PR 的迁移建议及冲突状况；
3. 离线 Mirror/Bundle 的保存路径、体积、校验 SHA256、`git bundle verify` 结果；
4. 预览分支完整测试与必要的预发布验收结果；
5. 将来强制切换 main 时需要执行的准确维护窗口、备份、服务器升级及回退步骤；
6. **明确声明当前是否对 main、生产容器、生产数据库、公开服务做过任何更改。**

## 操作安全边界

**现在允许：** 读取、备份、验证、搭建隔离测试环境、提交独立准备 PR。

**等待仓库所有者单独书面确认：** `git push --force` / `--force-with-lease` 到 `main`、更改 GitHub 主分支指向、发布上线、部署服务重启、生产数据库操作、清理远程分支和覆盖旧 Git 工作区。

请优先阅读 [REWRITE_PLAN.md](REWRITE_PLAN.md)，尤其是最后的回退与服务器历史分叉说明。后续批准阶段应重新核对所有 SHA，避免使用过期的硬编码提交号。
