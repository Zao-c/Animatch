# AniMatch 文档导航

本目录集中存放开发、部署、设计决策与验证记录。面向首次访问仓库的用户，请优先阅读根目录的 [README](../README.md)。

## 发布与维护

| 文档 | 用途 |
| --- | --- |
| [发布准备与截图规范](release-prep.md) | 公开发布前检查、演示截图拍摄与更新规范 |
| [服务器部署](deploy-server.md) | Docker Compose、环境变量、数据库备份与恢复 |
| [对决引擎](ranking-engine-current.md) | 当前动画对决计算逻辑 |
| [对决流水与计分边界](comparison-ledger.md) | 历史事件和计分规则 |
| [音乐曲单与音频共享](anisong-shared-audio.md) | 公开曲单、素材隔离、音频池和来源条件 |
| [音乐相关迁移与发布记录](anisong-migration-release.md) | 音频迁移与服务升级注意事项 |

## 功能和交互设计

| 文档 | 用途 |
| --- | --- |
| [动画界面优化路线](animematch-ui-optimization-roadmap.md) | 番组、对决与榜单的阶段优化 |
| [音乐对决交互](anisong-interaction.md) | 音乐大厅、对决与交互走查 |
| [音乐编辑工作区](anisong-workspace-parity.md) | 工作区操作与跨设备一致性 |
| [音乐任务抽屉](anisong-task-drawers.md) | 编辑管理和错误恢复 |
| [音乐 Tier 编辑](anisong-tier-editor.md) | 音乐榜单编辑与展示 |

## 历史资料与测试证据

- [原始 MVP 架构与实施方案](archive/AniMatch%20MVP%20%E7%A8%B3%E5%81%A5%E6%9E%B6%E6%9E%84%E4%B8%8E%E5%AE%9E%E6%96%BD%E6%96%B9%E6%A1%88.docx) —— 早期规划的归档版本，适合回顾设计背景
- [旧版界面截图](images/) —— 历史开发验收素材；正式展示图请按发布规范重新采集
- `anisong-*/` 截图目录与 `validation/` —— 专项测试、对照截图与命令日志
- 带日期的 UI / UX 审查、提案和发布说明 —— 保留设计决策及历史问题的可追溯性

**文档维护约定：** 新的使用说明优先更新根目录 README；长期有效的技术资料放在 `docs/`；阶段性验证证据与早期方案保留在对应历史目录。涉及账号、个人数据、服务器地址或凭据的发布材料，应在公开前人工复查。
