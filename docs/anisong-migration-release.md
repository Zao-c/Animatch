# AniSongMatch 发布前迁移与音源验收

日期：2026-10-31；基于 `a1e0ca6211b627fab3ea0c8dc814928c0bdd3139`。
独立分支：`codex/anisongmatch-release-hardening`。Prisma CLI / Client 6.19.3，PostgreSQL 16。

本报告复核了上一轮 `migration-design-validation.md`。本次没有改动历史迁移、生产数据库、部署入口或 UI 结构。

## 迁移方案审核结论

原报告确认的顺序错误成立。24 个迁移按字典顺序执行，第一个修改 `CustomPool`，第二个才创建它。空库直接 `migrate deploy` 仍会 P3018 / PostgreSQL 42P01。

原报告建议生成完整新基线并登记全部历史 ID。这需要覆盖原 SQL 的 CHECK、部分索引等 Prisma schema 无法完整表达的对象，审核成本较高。本次验证一个更窄的方案：**只在全新空库提前执行现有 initial SQL，登记该 initial ID，然后正常 deploy**。不生成新基线、不登记尚未执行的迁移、不修改已有文件。其余 23 个迁移由 Prisma 实际执行。

这是 Prisma v6 “对已存在 schema 登记已应用迁移”机制的项目适配方案，不是 Prisma 官方对此仓库的专项推荐。官方文档说明字典顺序与 `migrate resolve --applied` 的含义：[Prisma ORM v6 Baselining](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining)。官方通用基线示例会移动原迁移目录，本项目不采用该步骤，以保留生产账本对应文件。

### 全部依赖

| 迁移 | 先决对象 / 作用 |
|---|---|
| 20250617000000_add_tier_config | 修改 CustomPool；依赖下面的 initial，存在顺序倒置 |
| 20260608182702_initial_migration | 创建 User、Anime、CustomPool、PoolAnime、PersonalRun、UserPoolScore、PoolComparison、UserAnimeStatus、ManualTierAdjustment、UserTagPreference、AnimeRecommendation、UserSimilarity、RecalibrationSession 及基础枚举 / 外键 |
| 20260610183500_add_anime_local_fields | 扩展 Anime |
| 20260611024223_add_pool_anime_display_overrides | 扩展 PoolAnime |
| 20260611194500_add_tier_shares | TierShare 依赖 CustomPool、PersonalRun |
| 20260612020500_strengthen_pool_comparisons | 扩展 PoolComparison / 索引 |
| 20260613093000_add_tiermaker_import_source_type | 修改 AnimeSourceType / Anime |
| 20260614171500_add_pool_comparison_undo | 扩展 PoolComparison |
| 20260614193000_add_public_pool_foundation | 扩展 CustomPool |
| 20260618000000_add_battle_seasons | BattleSeason、BattleVote 依赖 CustomPool、User |
| 20260623000000_add_battle_season_user_scores | 扩展 BattleVote；分数表依赖 BattleSeason、CustomPool、User、Anime |
| 20260624000000_add_battle_vote_client_mutation_id | 扩展 BattleVote |
| 20260704093000_add_anime_cached_cover | 扩展 Anime |
| 20260704103000_track_cached_cover_source | 扩展 Anime 缓存来源 |
| 20260923000000_annual_taste | 修改 User；集合 / 归档依赖 User、CustomPool、BattleSeason；会更新已有 User.allowTasteMatching |
| 20261007080000_manual_tier_boards | ManualTierBoard 依赖 User、CustomPool |
| 20261011060000_award_nominations | AwardCeremony、AwardBallot 依赖 User |
| 20261014000000_award_live | 扩展 User、AwardCeremony；新增奖项现场表依赖 AwardCeremony、User、AwardRound |
| 20261026120000_personal_match_candidates | 扩展 PersonalRun |
| 20261026130000_pool_creation_requests | 新增 PoolCreationRequest |
| 20261029000000_anisongmatch | SongBoard 依赖 User |
| 20261030090000_shared_song_templates | SongTemplate / SongBoard 双向关联；新增 SongAudioAsset |
| 20261030120000_anisong_cos_audio | 扩展 SongAudioAsset |
| 20261030133000_anisong_preview_audio | 扩展 SongAudioAsset |

除 initial 提前外，后续完整链已在隔离数据库实际执行，无其他对象依赖失败。

## 可复现验证

需要 Docker、Python 3、项目 pnpm 依赖。执行：

```bash
python3 scripts/verify-migration-release.py
```

脚本自行创建随机名称的 PostgreSQL 16 容器、随机 loopback 端口、tmpfs 数据目录及四个数据库。它为每次 Prisma 调用覆盖 DATABASE_URL，完全不读取生产数据库；结束时停止并自动删除临时容器。输出证据目录在 `/tmp/anisong-migration-evidence-*`。失败日志也会保留。

验证顺序：

1. `broken` 库复现原链 P3018。
2. `fresh` 库先在事务内执行 original initial，再 `migrate resolve --applied 20260608182702_initial_migration`，随后 deploy、status、再次 deploy。
3. `old` 库实际执行并登记截至 `20261029000000_anisongmatch` 的迁移，写入纯合成 v1 曲单、投票、封面引用、上传音频关联、分享快照与固定分享 token。
4. `pg_dump` 导出旧库，恢复到 `restored`，执行余下 3 个迁移、status、再次 deploy；比较升级前后 JSON / token 完全相同。
5. Prisma diff 比较 fresh 与 restored；另外比较 public schema 全部约束与索引定义。
6. 将 fresh 对比 schema.prisma 的差异单独保存，绝不自动应用。

initial 原文件含 UTF-8 BOM。将其 SQL 放入事务前，脚本用 `utf-8-sig` 读取、仅在内存移除 BOM，磁盘迁移及 Prisma checksum 不变。首次试验发现直接拼接 BOM 会让 psql 报语法错误，已修正验证脚本。

本次运行结果：

| 项目 | 实际结果 |
|---|---|
| 未修复空库 deploy | 如预期失败，P3018 / 42P01 |
| initial 提前执行后的完整初始化 | 成功，23 个剩余迁移由 deploy 执行 |
| migrate status | fresh / restored 均 up to date |
| 重复 deploy | fresh / restored 均 No pending migrations |
| 旧库 dump / restore 后升级 | 成功，3 个待执行歌曲音频迁移 |
| 旧曲单 / 投票 / 封面与音频引用 / token / 快照保留 | 升级前后 SQL 查询结果一致（合成数据） |
| fresh vs restored Prisma diff | No difference detected |
| public 约束和索引定义 | 完全一致，包括 CHECK、部分索引 |
| fresh vs schema.prisma | **存在下述 6 个既有外键差异** |

证据见 [validation/anisong-release](validation/anisong-release)。这不是生产数据库恢复演练；生产真实备份和真实账本尚未接收。

### 发现的 schema 漂移

历史 `20260923000000_annual_taste` 创建的六个外键默认 ON UPDATE NO ACTION；当前 schema.prisma 期望 ON UPDATE CASCADE：

- AnimeCollection.ownerId、finalPoolId
- CollectionSource.collectionId、poolId、seasonId
- BattleSeasonArchive.seasonId

两条隔离安装路径都保留相同的历史行为。Prisma deploy 成功并不代表没有 drift。精确差异保存在 `schema-drift.sql`，**它是诊断输出，不能直接执行**。本次不自动改动这些与音乐无关的外键。

若产品确认需要 CASCADE，应另加新的前向迁移，审查锁表、外键校验耗时和并发写入影响，在恢复副本上演练；若要保留数据库现有行为，则经审核修改 Prisma 关系声明。生产目录和账本未核验前不能选择其一。

## 两种安装场景

### 全新 PostgreSQL 16

先由管理员确认目标是独立空库、无并发应用连接，备份 / 连接字符串已经人工复核。下列是**待审核的空库初始化操作**；本 PR 没有将其接入 docker-entrypoint，避免在已有库自动运行。

```bash
# NEW_DATABASE_URL 必须由操作者显式设置，不能复用默认生产连接。
# 在同一事务内拒绝已有表、视图、序列、外部表、分区表、枚举或其他用户类型，再执行 initial。
python3 - <<'PY' | psql "$NEW_DATABASE_URL" -X -v ON_ERROR_STOP=1
from pathlib import Path
print("BEGIN;")
print("""DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace
           AND relkind IN ('r','p','v','m','S','f'))
OR EXISTS (SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace)
THEN RAISE EXCEPTION 'Target is not empty'; END IF;
END $$;""")
print(Path('prisma/migrations/20260608182702_initial_migration/migration.sql').read_text(encoding='utf-8-sig'))
print("COMMIT;")
PY
DATABASE_URL="$NEW_DATABASE_URL" pnpm exec prisma migrate resolve --applied 20260608182702_initial_migration
DATABASE_URL="$NEW_DATABASE_URL" pnpm exec prisma migrate deploy
DATABASE_URL="$NEW_DATABASE_URL" pnpm exec prisma migrate status
DATABASE_URL="$NEW_DATABASE_URL" pnpm exec prisma migrate deploy
```

首次部署失败不可盲目重跑 bootstrap。新空库无业务数据时丢弃并重建即可；若 initial 已提交但 resolve 未完成，须人工核对 initial 所有对象后仅补登记该 ID。存在失败迁移记录时，应复核失败状态后在全新库重试，不自动删除账本。

此方案解决部署初始化，**没有修复 `migrate dev` 自动重建 shadow database 时的字典顺序**。新增迁移可在审核后的隔离库以 `migrate diff` 起草；不要声称原链可以直接用于 migrate dev。长期整理迁移目录 / 新基线仍需单独设计审核。

### 已应用历史迁移的生产库

沿用正常 deploy 路径，**不运行空库 bootstrap，也不批量 resolve 历史 ID**。必须先人工执行以下只读查询并审核结果；本次未对生产执行任何查询或写操作。

```sql
BEGIN TRANSACTION READ ONLY;
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
       applied_steps_count
FROM public._prisma_migrations ORDER BY started_at, migration_name;
SELECT conrelid::regclass::text AS object, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;
COMMIT;
```

将账本 checksum 与验证产物 `migration-checksums.json` 比较。确认 initial / tier-config 的真实完成状态、没有失败记录、没有缺失历史效果；不能仅凭名称推断已执行。若 initial 未登记但表已存在，必须先在恢复副本比较其完整效果，再另行审核 resolve；若 tierConfig 实际缺失，需要专门前向修复，不能虚报已应用。

管理员还需使用只读账号在受控环境导出 schema、受限保存备份，在隔离网络恢复并脱敏后演练 deploy、status、diff 和业务数据完整性。备份含用户数据，不能提交 Git。生产升级、resolve 或修复外键均需独立审核；本 PR 不授权执行。

风险：错连已有库、只登记不执行 SQL、失败后重复建表、遗漏 SQL-only 对象、部署并发、外键改动锁表。回滚：新库丢弃重建；已有库先停写并恢复已验证备份，或审核前向修复。Prisma 不会自动执行 down migration，不随意将成功记录标成 rolled-back。

## 网易云真实服务调查

已确认 `.env.production` 配置的是 Docker 服务名 `netease-api:3000`，没有 URL 内凭据；没有环境级 NETEASE_COOKIE。未读取或打印个人登录 Cookie。

- 网易云容器 running / healthy，restart count 0；应用和音源容器均在 `animatch_default`。
- 容器内首页 HTTP 200，真实 cloudsearch HTTP 200 / code 200。
- 生产应用容器到音源的匿名只读搜索 HTTP 200 / code 200。
- 宿主机解析 `netease-api` 返回 EAI_AGAIN。这是上一轮本地开发环境 502 的可复现原因，不能据此认定上游容器停机。
- 宿主机使用现有端口映射 `http://127.0.0.1:3301` 后真实搜索正常；应用 adapter 探针返回 20 个结果、有效试听地址、音频 HTTP 206 / audio/mpeg。单次原始探针音频为约 128 kbps 的试听源；不能保证所有歌曲可播。

复现命令（匿名、只读，不输出音频 URL 或凭据）：

```bash
NETEASE_API_URL=http://127.0.0.1:3301 pnpm exec tsx scripts/diagnose-netease.ts
```

Docker 中保留 `http://netease-api:3000`，宿主机本地进程显式覆盖 loopback 地址。未改动生产配置或容器。

适配器现区分：未配置、配置无效、DNS 故障、TCP 不可达、超时、上游非成功 HTTP、异常 JSON、账号 / 地区拒绝、限流。错误消息仅使用固定文案和 HTTP 状态码，不透传上游正文、URL、Cookie 或令牌；超时覆盖响应体读取。容器启动失败需要结合 docker inspect 状态判断，TCP 拒绝不能单独证明容器启动失败。上游 401/403 同样不能精确判定是账号还是地区。

页面现有 alert 会显示这些提示，引导继续使用 iTunes、公共音频池或本地音频；没有重构页面。31 个 NetEase 测试覆盖故障分类、账号隔离及凭据不泄漏；真实服务结果和 mock 测试分别记录。

## 历史兼容边界

找到的两份本机历史备份日期早于 SongBoard 上线，不能用于音乐历史验收。用户本轮表示无需继续查找；未读取真实用户曲单、未提交用户数据。

`validation/anisong-synthetic-v1.json` 是明确标记的合成数据，包含旧版缺少 manualOrder 的 v1 曲单、一次投票、封面、upload / netease 关联以及分享快照与固定 token。隔离恢复升级验证其字节表示不变；实际音频文件不包含在数据库备份中，需要单独备份音频目录 / COS 对象，JSON 引用保留不等于音频文件可访问。

真实脱敏旧曲单、既有用户分享链接和原音频对象的端到端验收仍未完成，不能将上述合成测试计作真实历史数据通过。

## 本轮浏览器与最终检查

使用独立 PostgreSQL 16 tmpfs 数据库、测试用户、测试 AUTH_SECRET 和空账号存储目录，在端口 3011 启动本地 production build。该浏览器测试库以 db push 准备，迁移验收则使用上文完全独立的四库演练，不能将 db push 算作迁移验证。

- **真实网易云成功路径**：页面搜索返回 20 个版本，加入两首曲目，进入 Match；第一首 readyState=4，currentTime 超过 3 秒，第二首保持暂停，无 pageerror。证据 `netease-browser.json`。
- **真实 DNS 失败路径**：将本地服务地址设成宿主机不可解析的 Docker 名称；页面明确显示地址无法解析与备用音源提示。随后在同一页面改用真实 iTunes 搜索，返回 20 个结果，添加两首后进入 Match，音频 readyState=4、播放时间持续推进，无 pageerror。证据 `netease-failure-itunes-browser.json`。
- 两条路径均未拦截或 mock 音源响应。第一次备用音源自动化因未处理页面已有切换确认框而超时；接受确认框后重跑成功，没有为此改动 UI。
- 浏览器截图保存在本机 `/root/.animatch-shots/release-*.png`，不包含个人凭据；文字结果随 PR 提交。

| 最终检查 | 结果 |
|---|---|
| pnpm test | 159 文件 / 1687 测试通过 |
| pnpm lint | 通过，无 warning / error |
| pnpm exec tsc --noEmit | 通过；添加诊断脚本后再次执行通过 |
| pnpm build | 通过 |
| git diff --check | 通过 |
| NetEase 专项复跑 | 31 个通过；保留网络错误文案和凭据不泄漏断言 |

没有删除测试或关闭 TypeScript 检查。历史迁移文件相对于验证基点没有变更。

当前交付可审核的窄范围修复与初始化流程，不代表允许生产发布。生产账本 / 真实备份恢复、6 个既有 FK 差异处置、空库流程的人工审核仍需完成；真实历史数据验收按用户本轮回复暂缓。没有合并 PR #2–#5、推送 main 或部署生产。
