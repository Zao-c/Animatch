# AniMatch UI 优化路线

这份文档是 AniMatch 后续 UI 优化的约束文件。它不改变运行时代码、API 或数据库，只定义后续界面改造必须遵守的视觉方向、页面优先级、组件规则和验收标准。

目标：把 AniMatch 从“深色后台 demo”调整为“简洁二次元轻竞技工具”。核心体验始终是：

> 用左右选择完成两两对决，生成自己的动画 Tier List。

## 1. Design North Star

AniMatch 应该像一个清爽的番剧对决场，而不是一个数据库管理后台。

设计关键词：

- 二次元，但不堆装饰。
- 简洁，但不空。
- 轻竞技，而不是企业 dashboard。
- 封面优先，因为动画作品靠视觉记忆被识别。
- 主动作优先，每个页面只突出一个最重要的下一步。
- 复杂能力渐进展开，不在首屏一次性暴露。

风格基调：

- 清爽番剧竞技场。
- 深色底可以保留，但要减少“全黑 + 青色按钮”的单一感。
- 用少量粉、紫、金、蓝、绿做层级和 Tier 识别。
- 动画封面、对决状态、榜单结果应成为页面主角。

明确避免：

- 通用 SaaS 后台布局。
- 等权重卡片堆满页面。
- 所有按钮和高亮都使用同一种青色。
- 霓虹、渐变、发光过多，压过动画封面。
- 搜索、导入、编辑、校准等管理工具全部外露。

## 2. Non-negotiable UI Rules

- 用户进入任何页面后，3 秒内必须知道下一步该做什么。
- 番组 ready 时，“开始对决”是全站最重要的动作。
- 作品封面优先于文字说明；文字用于解释，封面负责吸引和识别。
- 归档、删除、移除等危险操作不能和主动作同级显示。
- 高级功能放进抽屉、菜单、二级面板或折叠区域。
- 新 UI 必须优先使用 `AppButton`、`AppCard`、`AppBadge`、`PageShell`、`anime-field`。
- 不允许继续散落一次性的颜色、阴影、圆角和按钮 class；可复用状态必须沉淀为 token 或 variant。
- 移动端必须保证核心路径可用：创建番组、添加动画、开始对决、查看 Tier。
- 动效只服务于状态变化和反馈；必须尊重 `prefers-reduced-motion`。

## 3. Priority Roadmap

### P0: 建立真正的视觉系统

先建立 design tokens，再做页面级 polish。否则页面越多，视觉越散。

建议 Tailwind token 家族：

- `anime.bg`：应用深色背景。
- `anime.panel`：标准面板。
- `anime.panelStrong`：弹窗、抽屉或聚焦区域。
- `anime.cyan`：主动作。
- `anime.pink`：二次元强调色、S Tier 高光。
- `anime.purple`：次级动作、A Tier 高光。
- `anime.amber`：奖励、导出、分享高光。
- `anime.danger`：危险操作。
- `anime.muted`：低强调边框和文字。

组件规则：

- `AppButton` 统一按钮尺寸、variant、disabled、cursor、active feedback。
- `AppCard` 统一面板圆角、边框、模糊和阴影。
- `AppBadge` 统一状态、来源、Tier、warning、muted、danger chip。
- `anime-field` 统一 input、textarea、select。
- 页面实现不要再直接写 `bg-zinc-900`、自定义 glow shadow 或临时 border color，除非这些样式被收敛到共享组件。

### P0: 重做首页信息架构

首页应该用产品 demo 解释 AniMatch，而不是用功能列表解释。

目标首屏：

- 左侧：一句直接价值主张，例如“用左右选择，生成你的动画 Tier List”。
- 主 CTA：创建第一个番组，或继续最近一个 ready 番组。
- 次 CTA：查看我的番组。
- 右侧：mini match demo，两张动画封面、`VS`、左边/差不多/右边三个紧凑选择。
- 首屏下方：三步流程条，添加动画 -> 开始对决 -> 生成榜单。

必须修正：

- 减少当前大屏首屏的巨大空白。
- 用 mini match demo 替换抽象的 `Search / Match / Tier / Edit` 四宫格。
- 长 workflow 说明下移，不能抢首屏主角。

### P1: 番组详情页降噪

番组详情页功能强，但现在像管理后台：番组信息、搜索、分类浏览、手动添加、上传图片、Bangumi 导入、作品列表、显示修正、开始对决全部挤在一起。

目标结构：

- 顶部：番组身份、作品数量、ready 状态、下一步。
- 主动作：开始对决。
- 次动作：查看 Tier List。
- 三级动作：编辑番组、归档、导入、显示修正。
- 主区域：作品墙或紧凑作品列表。
- 侧栏/抽屉：添加动画。

添加动画规则：

- 默认只显示本地搜索。
- 一次只展示一种添加方式。
- 分类浏览、手动添加、上传图片、Bangumi 导入收进“更多导入方式”。
- 上传和手动添加可以保留完整能力，但不能和搜索在首屏同级竞争。

作品卡规则：

- 每个断点只选择一种卡片模型：管理型紧凑列表，或视觉型海报墙。
- 如果是海报墙，封面区域应占卡片主要面积。
- `编辑显示` 不应在单张卡片内部展开到破坏网格；优先用侧栏或 modal。
- 移除和危险操作默认低调，放 hover、更多菜单或编辑模式里。

### P1: 把 Match 页面做成竞技场

Match 是 AniMatch 的核心体验，应该快、聚焦、有轻微游戏感。

目标布局：

- 两张对手卡片更大，封面是主视觉。
- 中间 `VS` 保持紧凑，不要过度拉开两张卡。
- 整张卡片可以点击选择，同时保留明确主按钮。
- 默认可见信息只保留标题、副标题、年份/类型等辅助识别内容。
- 默认隐藏 Elo、AniScore、详细对决统计，放进展开详情。
- 底部动作保持低强调：差不多、跳过、左边没看过、右边没看过、两个都没看过。

键盘快捷键：

- `←`：选择左边。
- `→`：选择右边。
- `↑`：差不多。
- `↓`：跳过。
- `1`：左边没看过。
- `2`：右边没看过。
- `0`：两个都没看过。

反馈规则：

- 提交后给 150-250ms 的视觉反馈，再出现下一组。
- 胜者卡片短暂高亮。
- 跳过时安静退出，不要强奖励。
- 错误提示不能破坏当前对决上下文。
- reduced-motion 用户直接切换状态，不播放非必要位移动画。

### P1: Tier List 做成可分享的榜单墙

Tier List 是最终产物，应该有导出和分享价值。

顶部动作层级：

- 主动作：导出图片、分享榜单。
- 次动作：继续对决、返回番组。
- 高级动作：编辑最终设定、恢复系统排序、校准榜单、编辑分层标签。
- 高级动作应分组或折叠，不要平铺在顶部。

Tier 行规则：

- 使用更强的 tiermaker 式色块。
- S：粉/金高光。
- A：紫。
- B：蓝。
- C：绿。
- D：低强调灰绿。
- 空 Tier 是轻量 drop zone，不是大块重面板。
- 自定义 Tier 标签是特色能力，导出和分享时必须清晰可见。

Tier 卡规则：

- 优先展示封面、标题、Tier 相关状态。
- Elo 和完整统计是二级信息。
- 拖拽必须有清晰的 grab、hover、drop 状态。

### P2: 支撑页面统一 polish

番组列表：

- 每张卡加入前 3-5 个动画封面缩略图。
- 显示作品数、对决数、信心指数、最近更新等有用状态。
- 主动作是进入或继续对决。
- 编辑是次动作。
- 归档/删除进入更多菜单或确认流程。

新建番组：

- 必须使用 `AppCard`、`AppButton`、`AppBadge`、`anime-field`。
- 做成 onboarding card，不要把表单直接贴在背景上。
- 提供示例名称，例如“2024 年度动画排名”“JUMP 系作品对决”。
- 右侧或下方展示流程预览：创建番组 -> 添加 4-8 部动画 -> 开始对决 -> 生成 Tier List。

导航：

- 顶部导航保持简单，但功能成熟后应有清晰入口：首页、我的番组、当前对决、Tier、设置。
- 在具体番组内，提供番组详情、对决、Tier 的快速切换。
- 移动端优先考虑 bottom nav 或紧凑 tabs。

可访问性与响应式：

- 深色背景上的重要辅助文字至少使用 `text-slate-400` 级别。
- 所有可点击控件必须有 pointer cursor、hover、focus-visible、disabled。
- 移动端 tap target 至少 44px 高。
- 文本不能溢出按钮、卡片或 badge。
- 不使用 viewport-based font scaling；使用固定响应式字号阶梯。

## 4. Page-by-page Direction

### Home

目标：让新用户通过一个模拟对决理解产品。

必须做到：

- 减少 hero 垂直空白。
- mini match demo 替代静态功能四宫格。
- 标题说明产品价值，而不只是展示品牌名。
- 长说明和 workflow 放到首屏之后。

### Pools

目标：让番组像活跃的动画集合，而不是数据库记录。

必须做到：

- 加封面预览条。
- 展示可行动进度。
- 进入或继续对决是主动作。
- 归档/删除离开卡片主操作区。

### New Pool

目标：让创建过程像 onboarding。

必须做到：

- 表单包进精致的 `AppCard`。
- 加示例和短 helper copy。
- 加流程预览。
- 只使用共享字段和按钮。

### Pool Detail

目标：让用户准备开始对决，同时保留管理能力。

必须做到：

- 顶部回答：有几部动画、是否 ready、下一步是什么。
- 主工作区优先展示动画封面。
- 添加面板默认是搜索。
- 其他添加方式折叠。
- 显示修正使用 modal 或侧栏。

### Add Anime

目标：降低导入焦虑。

必须做到：

- 搜索优先。
- 分类、手动、上传、Bangumi 是二级入口。
- 每种模式只展示一个聚焦表单。
- 上传状态必须明确显示已选文件、错误和最终提交。

### Match

目标：让每次选择快速、有反馈。

必须做到：

- 封面更大。
- 默认少展示数学指标。
- 整卡可选。
- 支持键盘。
- 有短反馈动效。
- 次要选择更低调。

### Tier List

目标：让榜单像可以导出分享的作品。

必须做到：

- 强 Tier 标签。
- 导出/分享优先。
- 高级控制分组。
- 空 Tier 轻量化。
- 自定义分层标签作为特色能力展示。

## 5. Component & Token Rules

后续 UI 工作可以新增或调整这些 UI 层接口：

- Tailwind theme extension：颜色、阴影、圆角、过渡时间。
- `AppButton` variants：`primary`、`secondary`、`ghost`、`danger`，必要时加 `quiet`。
- `AppButton` sizes：`sm`、`md`、`lg`，必要时加 `icon`。
- `AppCard` variants：default panel、soft panel、focus panel、modal panel。
- `AppBadge` tones：source、status、tier、success、warning、danger、muted。
- 页面布局 helper：hero、toolbar、split panel、side drawer、mobile bottom nav。

Token 命名按用途，不按页面：

- 使用 `primary`、`accent`、`surface`、`surface-raised`、`border-muted`、`text-muted`。
- 不用某个页面名或一次性状态命名通用 token。

## 6. Motion, Accessibility, Responsive Checklist

动效：

- 动效用于选择、保存、提交、排序、打开、关闭。
- 常规过渡控制在 150-250ms。
- App shell 不做持续抢眼的装饰动效。
- 加复杂动效前，先加入全局 reduced-motion 规则：

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

可访问性：

- 保留 `:focus-visible`。
- label、helper text、disabled state 保持足够对比度。
- Tier、warning、destructive 状态不能只靠颜色表达。
- Match 需要键盘路径；Tier 拖拽需要替代操作或明确 fallback。

响应式：

- 桌面 Match 可使用两列卡片 + 中间 `VS`。
- 移动端 Match 应堆叠卡片，或使用更适合滑动的一组对决布局。
- 添加面板在移动端变成 drawer 或全屏 sheet。
- Tier 行可以横向滚动，但左侧标签必须可读。

## 7. Acceptance Criteria For Future UI Work

每次合并 UI 改动前检查：

- 页面只有一个最明显的主动作。
- 长动画标题不会撑破布局。
- 能用共享 UI primitive 的地方没有手写一次性 class。
- 没有新增无法复用的临时颜色或阴影。
- 危险操作低于导航和创建操作的视觉优先级。
- Match 可以用鼠标和键盘快速完成选择。
- 首屏不被空背景或大段说明文字占据。
- 需要识别作品时，动画封面足够可见。
- 移动端主流程可用，没有页面级横向溢出。
- reduced-motion 用户不会被迫观看非必要动画。

