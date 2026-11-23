# AniMatch Git 历史整理 — 服务器 AI 交接目录

这份目录用于把 `main` 的 **493 个 Commit** 整理成 **8 个发行里程碑 Commit**。现在仅进行备份、预检、预览与迁移规划。**正式主分支 main 保持现有 SHA；任何强制推送、生产部署、数据库变更或删除分支，均须仓库所有者另行明确批准。**

## 当前已核实的远程引用（2026-11-23）

| 用途 | 分支 | Commit |
| --- | --- | --- |
| 正式主分支 | `main` | `68aee4df118acb8d4c3e97966f05d5f70a23c33c` |
| 493 Commit 完整历史备份 | `backup/main-full-history-20261123` | `68aee4df118acb8d4c3e97966f05d5f70a23c33c` |
| 8 Commit 精简预览 | `preview/main-release-milestones-20261123` | `3e26bf2746908b2b5b75270a8252c8040c93491a` |

两条历史的最终 **Git Tree SHA** 都是 `7e890ff74691dba21747119e2e3710c8cbcf91ad`。因此预览版的最终受版本控制的代码和文档与原 `main` 一致。GitHub Compare 会显示因历史分叉产生的大型差异，请以 Tree SHA 或 `git diff main preview` 的实际结果作为文件一致性依据。

## 文件导航

- [SERVER_AI_TASK.md](SERVER_AI_TASK.md)：直接发送给服务器 AI 的工作任务、执行范围和验收输出
- [REWRITE_PLAN.md](REWRITE_PLAN.md)：完整历史方案、8 个里程碑、PR 迁移、服务器部署、切换与回退
- [preflight_and_full_backup.sh](preflight_and_full_backup.sh)：仅在本地生成完整 Git Mirror/Bundle、SHA 校验的只读备份脚本

## 在服务器上安全获取交接文件

请让服务器 AI 在现有 AniMatch 项目工作区执行：

```bash
git fetch origin ops/history-rewrite-handoff-20261123
git show origin/ops/history-rewrite-handoff-20261123:ops/history-rewrite/SERVER_AI_TASK.md
```

`git fetch` 会下载交接分支的 Git 对象，但会保留当前已检出的工作分支。服务器 AI 读取 `SERVER_AI_TASK.md` 后按文档继续。

需要脚本时，以独立工作区检出交接分支，保护正在提供服务的现有目录：

```bash
git worktree add --detach ../animatch-history-handoff origin/ops/history-rewrite-handoff-20261123
cd ../animatch-history-handoff
cat ops/history-rewrite/SERVER_AI_TASK.md
```

正式备份文件建议放在单独备份盘，不存储在仓库内；避免上传数据库凭据、个人数据或音频内容。

## 执行边界

**现在可以：** 核对部署 SHA、采集经过脱敏的服务器配置、制作离线 Git Bundle、测试精简预览、准备 PR #1/#23/#33 的迁移分支和报告。

**需要再次批准：** 强制更新 `main`、发布新生产版本、清理远端分支、停机、执行数据库迁移/回滚、修改业务或音频共享规则。

当有任一引用发生变化时，暂停当前方案并重新计算里程碑及最终 Tree。
