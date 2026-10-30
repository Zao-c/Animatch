# 网易云音乐接入

实现日期：2026-10-30。使用第三方 [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 4.41.1，[接口文档](https://neteasecloudmusicapienhanced.js.org/)。

## 页面使用

1. 登录 AniMatch，在「音乐对决」中新建或打开曲单。
2. 打开「从网易云找歌」，输入歌名和歌手，核对候选的歌手、专辑及封面。
3. 选好 OP / ED、所属动画和季度，点击「加入曲单」。相同网易云歌曲编号不会重复导入。
4. 在曲单或左右对决卡片点击试听。默认从平台返回音频的开头试听30秒，可编辑起点和长度。
5. 需要账号权限时点击「扫码连接网易云」，使用自己的网易云 App 扫码并确认。连接只用于当前 AniMatch 用户；可随时点击「断开网易云」。

搜索、加入曲单和播放是分别处理的。搜索到歌曲不保证存在可播放音源，登录也不会自动获得会员、购买或地区权限。平台可能只返回试听片段；无法播放时会显示原因，可以更换版本或上传有权使用的本地音频。

## 部署

在 AniMatch 仓库中运行：

```sh
docker compose -f docker-compose.netease.yml up -d
```

镜像固定到已核对的4.41.1摘要，关闭备用音源解锁；接口端口只绑定服务器 `127.0.0.1:3301`。Compose 服务名为 `netease-api`，与生产应用使用同一默认网络。不要使用 `--remove-orphans`，避免删除另一个 Compose 文件中的现有应用和数据库。

在 `.env.production` 中设置：

```dotenv
NETEASE_API_URL=http://netease-api:3000
```

更新 AniMatch 应用后生效：

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build app
```

宿主机直接运行的本地预览使用 `NETEASE_API_URL=http://127.0.0.1:3301`。不配置该变量时，搜索面板提示服务未配置，本地音频仍可使用。

登录状态保存在 `NETEASE_ACCOUNT_DIR`，默认 `data/netease-accounts/`；生产 Compose 使用独立 `netease_accounts` 卷。凭据以 `AUTH_SECRET`（兼容回退 `NEXTAUTH_SECRET`）派生密钥进行 AES-256-GCM 加密，并按 AniMatch 用户隔离。轮换密钥后需重新连接网易云。请把此卷纳入私有备份，并保留对应密钥。单个应用进程内串行处理同一用户的扫码与断开操作；多副本部署前应改用共享凭据存储和分布式协调。

上游接口错误对象可能包含敏感内容，因此接口容器禁用日志持久化；应用只向浏览器返回经过整理的状态和错误。Cookie、二维码登录 key 不返回给浏览器，不写入歌曲文档、分享快照或榜单导出。

## 接口与播放

- `GET /api/anisong/netease/search?q=…`：登录 AniMatch 后搜索，返回最多20个候选。
- `GET /api/anisong/netease/account`：当前用户的服务和登录状态。
- `POST /api/anisong/netease/account`：JSON `action=start/poll/disconnect`；扫码 key 由服务器关联到当前用户。
- 原歌曲保存接口接受 `neteaseId`，重新读取平台元数据后保存 `{ kind: "netease", id }`，音频文件和临时播放地址不入库。
- `GET /api/anisong/boards/[boardId]/playback/[trackId]`：检查曲单归属后获取当前账号可用的播放地址，浏览器直接播放。地址短期复用，到期或加载失败后重新获取；不通过应用服务器下载、保存音乐。
- 请求有超时和按用户、操作划分的限频；上游请求使用独立随机缓存键，避免不同账号复用缓存结果。
- 编辑元数据保留网易云关联；上传音频或填写直链可替换，明确移除音频则清除关联。
- 分享快照继续只包含封面、歌曲信息和分档，不公开音源和登录状态。

## 验证

- 77项音乐功能定向测试通过，包括账号凭据加密与隔离、同用户操作顺序、二维码归属、媒体域名、错误整理、重复导入及编辑保留音源。
- 真实上游与 Chromium：搜索 YOASOBI《アイドル》，导入歌曲编号2034742057及封面、动画季度，实际解码并播放平台返回的45秒试听；验证暂停、二维码生成/轮询、其他用户不能获取曲单音源，320/390/768宽度无横向溢出。
- 模拟延迟/过期/不可用音源的浏览器回归通过：迟到的请求不抢占另一首、只有一个播放器、过期地址刷新、失败后重试、试听不投票、账号变更停止播放及对决进入榜单。
- 截图和真实接口验收记录在 `output/anisong-netease/`。测试没有扫描真实个人账号的登录二维码；最终登录需用户在页面上完成。
- 本地上传浏览器回归通过：批量暂停/继续、片段编辑和停止、编辑器/卡片互斥、手机宽度、移除音频。

## 2026-10-30 上线记录

- 已部署固定版本网易云接口容器，并更新正式 AniMatch 应用；公网 `/anisong` 和 `/api/health` 返回200，数据库21项迁移均已应用。
- 上线前备份数据库并核验备份目录可读，保留旧应用镜像和环境配置；此次数据库升级仅新增音乐曲单表及索引/外键。
- 在公网地址通过临时验收账号完成真实搜索、封面导入、45秒MP3试听解码与播放、390像素布局、二维码生成/轮询和断开连接。验收账号、曲单及其空凭据文件已清理。
- 生产 Node 20 Docker 构建包含 TypeScript / ESLint 检查并通过；网易云接口与应用健康检查通过。生产验收记录位于 `output/anisong-netease/production-verification.json`。
- 用户入口：`http://182.61.136.105:3000/anisong`。在自己的 AniMatch 账号内打开曲单，展开网易云搜索，再点击「扫码连接网易云」。
