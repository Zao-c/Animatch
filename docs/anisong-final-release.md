# AniSongMatch 最终发布验收：No-Go，待人工签核

日期：2026-10-31（Asia/Shanghai）。本轮验收代码基点 `5ab6004a286a684613f9071e602b2b6e18f419c3`，PR #6 / `codex/anisongmatch-release-hardening`。本轮仅补充报告、人工初始化确认步骤和启动脚本注释，没有新增 UI 或迁移。

**技术演练通过；当前发布决策为 No-Go，等待负责人接受已查明的历史校验和例外、确认覆盖边界，并审核最终合并结果。** 六个历史外键差异不阻碍本次音乐功能运行。生产没有待执行迁移，本次不需要为音乐重构修改外键或账本。

## 生产只读审核

本轮用户明确授权了生产只读审核与实际备份隔离恢复。生产查询通过 `docker exec animatch-postgres` 的本地连接执行，设置 `default_transaction_read_only=on`，查询放在 READ ONLY 事务中；没有执行生产 migrate、resolve、db push、DDL 或业务写入。pg_dump 使用只读事务导出。

核对了全部 24 个迁移：每个只有一条成功且未回滚记录，没有活动失败记录、缺失迁移或额外迁移。仓库文件的 SHA-256 全部与上一轮 `validation/anisong-release/migration-checksums.json` 相符。生产账本有 23 个相符，**initial 有 1 个不符**，逐项结果列于文末。

只读查询可由管理员复核，输出必须保存在受限目录：

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT migration_name, checksum, finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count
FROM public._prisma_migrations ORDER BY migration_name, started_at;
SELECT conrelid::regclass::text AS object, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace='public'::regnamespace AND contype='f'
ORDER BY 1,2;
COMMIT;
```

### initial 校验和例外

| 来源 | SHA-256 |
|---|---|
| 生产账本 | `a94f7c2da65155b41f901b226078f6db0b1dff1d513f7a3849c452222097207a` |
| 当前文件、上一轮报告及已运行应用容器中的文件 | `f16d1f24769c89a41c519d61430742e62cc6966a30df589238ada3341d7bffff` |
| 历史 Git 提交 `e92f58058c2cadba7d8e776ac798d531eb3baed5` 中的文件 | 与生产账本完全相同 |

差异不是单纯换行：历史提交 `ffbde1b2436823f803d7118c4f64125f06dcdd7a`、`cde0d72bb79e1349cceece321db9dd0b8f4a9e21` 修改过 initial；当前文件增加 BOM，将 Anime.bgmId 改为 nullable，并加入本地动画字段。这些字段另有 `20260610183500_add_anime_local_fields` 的前向 SQL。该前向迁移在生产账本中成功且 checksum 匹配，恢复副本与当前 schema 的差异仅为下述六个外键，未发现相应字段缺失。

本次没有编辑这些历史文件、更新生产 checksum、重跑 initial 或伪造 resolve。恢复副本上的 status/deploy 成功不能覆盖独立校验发现的历史完整性例外。负责人应审核上述 Git diff、字段现状和例外说明，决定是否接受本次应用发布；若不接受，先单独设计迁移历史治理方案，不通过改账本消除告警。

[Prisma v6 文档](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)说明 deploy 不负责 schema drift 检查，故本轮同时比较了实际 schema。[Prisma 校验和实现](https://github.com/prisma/prisma-engines/blob/main/schema-engine/connectors/schema-connector/src/checksum.rs)说明其基于 SHA-256，并兼容部分换行差异；本例明确存在 SQL 内容变更。

## 六个外键影响

生产与实际备份恢复库均为 ON UPDATE NO ACTION；当前 Prisma schema 隐含 ON UPDATE CASCADE。ON DELETE 完全一致。

| 外键 | 被引用主键 | 现有 ON DELETE | 对本次音乐发布的影响 |
|---|---|---|---|
| AnimeCollection.ownerId | User.id | CASCADE | 正常用户 / 曲单操作不修改 User.id；不阻断 |
| AnimeCollection.finalPoolId | CustomPool.id | SET NULL | 修改 finalPoolId 关联仍正常；不阻断 |
| CollectionSource.collectionId | AnimeCollection.id | CASCADE | 修改集合内容不修改集合 id；不阻断 |
| CollectionSource.poolId | CustomPool.id | CASCADE | 正常曲池操作不修改主键；不阻断 |
| CollectionSource.seasonId | BattleSeason.id | CASCADE | 正常赛季操作不修改主键；不阻断 |
| BattleSeasonArchive.seasonId | BattleSeason.id | CASCADE | 归档写入 / 读取不修改赛季主键；不阻断 |

NO ACTION 会在仍被引用的父记录主键改号时拒绝操作，CASCADE 则传播新主键。该差异不改变读操作、普通字段更新、外键列重新关联或删除行为。已检查 collection-service、season-archive 和 anisong 服务路径：音乐曲单、投票、Tier、模板更新不对这些父主键改号；这些外键也不直接引用 SongBoard / SongTemplate / SongAudioAsset。

**建议保留现有数据库约束，本次不执行 schema-drift.sql。** 未来如果要支持主键改号或统一 schema，另开前向修复，评估锁表与关联业务；当前不能宣称数据库与 Prisma schema 完全一致。

## 实际生产备份恢复演练

本轮重新从生产 pg_dump 导出一致性快照，备份约 17.6 MB。源连接强制只读并设置锁等待上限，未暂停或修改生产业务。

原始备份、用户字段、share token、表内容指纹、恢复日志和服务日志全部保存在仓库外 `/root/.animatch-release-private/`（目录权限 0700，文件 0600）。没有提交 GitHub；没有生成或上传真实用户截图，也没有导出网易云个人凭据。

恢复使用 PostgreSQL 16 临时容器：`--network none`、tmpfs 数据目录，无 TCP 发布端口。主机工具仅通过受限目录内的 Unix socket 连接副本；副本无法访问生产网络。初次尝试 internal 网络时主机无法连接，已弃用该容器，重新以此隔离方式完整恢复并重跑。

| 项目 | 本次实际结果 |
|---|---|
| pg_restore --exit-on-error | 成功 |
| migrate status | 成功，24 个迁移 up to date |
| migrate deploy，随后 status，再次 deploy | 均成功，两次均无待执行迁移 |
| 业务数据完整性 | 全部 33 张非迁移表逐表比较行数与排序后的行内容哈希，完全一致 |
| 当前 schema 对比 | 只剩已知六个外键差异；诊断 SQL 未执行 |
| 真实旧曲单读取 | 2 / 2，均为没有 manualOrder 的 v1 格式 |
| 排名重建 / 新快照计算 | 2 / 2，在内存计算，未保存回数据库 |
| 投票与媒体关联读取 | 8 条投票、30 首曲目、29 个封面引用正常读取；29 个远程音源引用可解析为原结构 |
| 认证后的曲单 GET API | 2 / 2，返回文档与副本原文一致 |
| Match / Tier 页面 GET | 各 2 / 2，HTTP 200；本轮不是完整浏览器交互复测 |
| 旧 ?view=match 路由 | 2 / 2，正确跳转新 Match 路由 |
| 真实既有分享快照 / 链接 | **备份中为 0，无法验证**，不记作通过 |
| 真实 upload / pool 引用端到端播放 | 曲单中两类引用均为 0，无法用本批数据验证；未以合成样本代替 |

本次没有清理或改写恢复的用户记录；测试会话只在内存签名并用于 loopback 本地服务，没有使用生产登录凭据。音频目录、封面上传目录和 COS 对象不在数据库备份里，本轮没有恢复这些媒体对象；远程引用的结构读取通过，不代表所有真实音源今天都可播放。上一轮合成分享与真实 iTunes / 网易云浏览器验收可补充覆盖，不能取代缺失的历史样本。

复核材料位于本机受限目录：`ledger-comparison.json`、`production-fks.csv`、`restore-result.txt`、`before-fingerprints.json`、`after-fingerprints.json`、`compat-result.json`、`http-compat-result.json`。它们不属于公开 PR 产物。运行脚本也仅保存在该目录，避免意外将真实数据日志纳入版本控制。

## Docker 启动与空库

Dockerfile 以 `sh scripts/docker-entrypoint.sh` 启动。脚本保留 `set -e → pnpm prisma migrate deploy → pnpm start`，本轮只加解释注释。

已用不连接数据库的 pnpm 替身检查命令顺序：迁移成功才启动应用；迁移返回 1 则脚本返回 1、不会启动。`sh -n` 通过。不存在自动判空、自动 db push、自动 initial 或 resolve。

全新空库需要独立管理员按 [人工初始化路径](anisong-migration-release.md#全新-postgresql-16) 操作；该流程已有隔离 PG16 验证，本轮加入交互终端与明确确认口令门槛。管理员必须先核对 NEW_DATABASE_URL 的目标库、无业务数据、无其他连接，再确认；SQL 检查只是拒绝已有对象的附加保护，不作为自动判断“允许初始化”的依据。

现有生产库不走此流程。空库直接启动现有容器仍会因旧顺序错误失败，这属于安全拒绝；不能把自动修复空库接入生产启动路径。`migrate dev` shadow 重放顺序问题仍留待独立治理。

## PR 堆叠与合并操作顺序

只读获取 GitHub 当前 PR 元数据：#2–#6 均 open / draft / 未合并；查询时均显示可合并。逐对 `git merge-base --is-ancestor` 返回成功；对 feature 基点与 #6 基点做 `git merge-tree --write-tree`，无冲突，输出树与 #6 相同。本轮没有执行任何分支合并。

| 顺序 | PR 与当前 head | 当前 base | 合入后的回归门槛（待合并时执行） |
|---|---|---|---|
| 1 | #2 route-split / 88266fca | feature/anisongmatch | 新 library / match / tier 路由、旧 view 参数跳转、刷新恢复、普通 Match |
| 2 | #3 duel-ui-cover / 890c1900 | codex/anisongmatch-route-split | 普通与音乐卡片投票、播放器点击互斥、快捷键、高清封面失败回退、PNG；320/390/768/桌面 |
| 3 | #4 tier-editor / 2fa3baec | codex/anisongmatch-duel-ui-cover | 跨档与档内排序、保存刷新、undo/reset、409、旧 manualOrder 缺省、分享与导出 |
| 4 | #5 library-cleanup / a1e0ca62 | codex/anisongmatch-tier-editor | 各音源添加、MP3/WAV、批量导入、范围、未保存确认、完整曲单→Match→Tier 链路；包含最终测试断言修复 |
| 5 | #6 release-hardening / 5ab6004a（本轮追加报告） | codex/anisongmatch-library-cleanup | 网易云故障分类 / 凭据不泄漏、真实服务与 iTunes 备用、空库 / 恢复副本、完整自动检查 |

建议每次将当前 PR 合入共同集成分支 `feature/anisongmatch`：先 #2；然后在下一 PR 合并前将其 base 改为 feature；依次 #3、#4、#5、#6。每次检查 diff 只含当前阶段变更，再人工确认。保留父分支直到所有子 PR 目标调整完成。

使用保留祖先关系的 merge commit，避免 squash / rebase merge 使下游祖先丢失、重带旧提交。若团队要求 squash，应先制定逐级重放和重新验收方案。不得按当前 base 直接点击后续 PR 合并，否则只是合入父功能分支，不代表已进入 feature。

每个阶段运行对应测试；共享代码阶段执行普通 Match 回归。最终 feature 集成树必须执行 pnpm test、lint、tsc --noEmit、build 和完整浏览器核心流程。中间阶段可能缺少 #5 中同步后的源码断言，出现失败时必须定位，不能删断言；本轮没有声称逐个旧阶段测试通过。

#2–#6 都不以 main 为目标。它们完成后，另行审核 `feature/anisongmatch → main` 的完整交付 PR，其中还包含 #2 之前的音乐功能及媒体配置。合并代码不授权部署；届时重新确认 main / feature / #6 SHA、CI 和最新备份，避免使用本报告的冻结 SHAs 推断后续状态。

## Go / No-Go 和人工步骤

**No-Go：暂不直接发布生产。** 技术障碍已经缩小为审核与覆盖问题，而非六个外键阻断：

1. 负责人审核并签收 initial 已被历史编辑的校验和例外。可在不修改历史文件 / 账本的前提下，基于历史溯源、字段现状和无待迁移结果接受本次应用发布；否则先处理独立治理方案。
2. 负责人明确接受备份中无真实分享、upload / pool 曲单的覆盖边界，或提供相应授权样本后补验。不能将 0 条样本记为成功。
3. 按上述堆叠顺序人工合并、审核最终 feature→main 交付树并执行最终回归。本报告不代替合并后检查。
4. 真正发布前重新只读核对账本、实际 schema 与待执行迁移列表；若出现任何新迁移 / 失败记录 / 未知 drift，停止沿用本次无 DDL 判断。
5. 人工确认当前运行镜像的可回退 digest、应用配置、持久卷、音频与封面目录及 COS 对象保留策略，保存新的受控备份。真实部署需要另行明确授权。

满足上述条件后，可对“沿用现有 schema、保留六个 FK、正常 deploy 无待迁移”的应用发布给出 Go；不要求为了本次音乐 UI 重构先修改无关外键。

### 回滚

当前生产账本已包含全部 24 个迁移，#2–#6 无新增数据库迁移。若发布前复核仍无待迁移，首选回退到管理员预先记录的运行镜像和配置，保留数据库与媒体卷，避免恢复旧库造成上线后新增投票 / 歌曲丢失。manualOrder 是可选 JSON 字段；旧版本回退前仍应检查其编辑是否会覆盖新顺序。

若实际发现新 DDL 或数据不兼容，先停写并保留故障时快照，再人工决定前向修复或恢复受控备份到独立库、核对后切换。恢复旧备份可能丢失快照之后的数据，必须确认 RPO 并处理差量；不直接覆盖运行库。媒体文件 / COS 对象需与数据库引用对应备份，回滚不删除音频或图片。绝不重跑 initial、删除迁移账本、执行 schema-drift.sql，或把成功迁移随意标成 rolled-back。

## 验证范围与代码检查

上一轮基点全量检查：159 个文件 / 1687 个测试、lint、TypeScript、build 通过，网易云专项 31 个通过。本轮应用源码未变，因此没有无意义地重复全套测试；新执行的是生产只读审核、真实备份恢复 / deploy / status / diff、33 表完整性、真实曲单服务与 HTTP 读取，以及启动顺序替身检查、sh -n 和 git diff --check。所有生产数据相关原始产物保留私有。

## 逐项校验和结果

下表的“报告与本地”均指完整 SHA-256 相同；“生产”指账本成功记录与该 SHA-256 比较。没有只比较名称或摘要前缀。

| 迁移 | 报告与本地 | 生产账本 |
|---|---|---|
| 20250617000000_add_tier_config | 一致 | 一致 |
| 20260608182702_initial_migration | 一致 | **不一致，见 initial 溯源** |
| 20260610183500_add_anime_local_fields | 一致 | 一致 |
| 20260611024223_add_pool_anime_display_overrides | 一致 | 一致 |
| 20260611194500_add_tier_shares | 一致 | 一致 |
| 20260612020500_strengthen_pool_comparisons | 一致 | 一致 |
| 20260613093000_add_tiermaker_import_source_type | 一致 | 一致 |
| 20260614171500_add_pool_comparison_undo | 一致 | 一致 |
| 20260614193000_add_public_pool_foundation | 一致 | 一致 |
| 20260618000000_add_battle_seasons | 一致 | 一致 |
| 20260623000000_add_battle_season_user_scores | 一致 | 一致 |
| 20260624000000_add_battle_vote_client_mutation_id | 一致 | 一致 |
| 20260704093000_add_anime_cached_cover | 一致 | 一致 |
| 20260704103000_track_cached_cover_source | 一致 | 一致 |
| 20260923000000_annual_taste | 一致 | 一致 |
| 20261007080000_manual_tier_boards | 一致 | 一致 |
| 20261011060000_award_nominations | 一致 | 一致 |
| 20261014000000_award_live | 一致 | 一致 |
| 20261026120000_personal_match_candidates | 一致 | 一致 |
| 20261026130000_pool_creation_requests | 一致 | 一致 |
| 20261029000000_anisongmatch | 一致 | 一致 |
| 20261030090000_shared_song_templates | 一致 | 一致 |
| 20261030120000_anisong_cos_audio | 一致 | 一致 |
| 20261030133000_anisong_preview_audio | 一致 | 一致 |
