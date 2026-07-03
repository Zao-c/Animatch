# Pool Awards 池内颁奖典礼

## 产品定位

Pool Awards 是 AniMatch 中围绕单个动画池生成的颁奖与讨论页面。它基于用户的个人排序、社区聚合结果、提名投票和手动补充内容，为每个动画池产出一整套奖项结果。

它不是单纯的排名页，而是把 Tier List 转化成更有表达感、更适合围观和讨论的颁奖现场。

## 核心价值

AniMatch 当前解决的是“我更喜欢哪部动画”。Pool Awards 进一步解决：

- 这个池子里大家公认的最佳是谁？
- 哪些作品最有争议？
- 我的选择和社区差在哪里？
- 哪些角色、单集、OP、CP、制作人员被大家记住？
- 哪些作品是遗珠、陪跑、惊喜或失望？
- 一个 Pool 最后能不能形成一张好玩、热闹、可分享的结果页？

## 页面入口

Pool 详情页增加一级入口：

```text
作品 / 对决 / Tier / 颁奖
```

页面路径：

```text
/pools/[poolId]/awards
```

页面标题示例：

```text
《动画池名称》金饭团奖
```

## 页面结构

颁奖页由多个大类组成，每个大类下包含多个奖项。每个奖项展示：

```text
奖项名
社区获奖
我的选择
提名名单
参与人数
共识度 / 分歧度
热区文案
操作按钮
```

基础布局：

```text
顶部概览区
- Pool 名称
- 参与人数
- 已完成奖项数
- 待提名奖项数
- 我的结果与社区一致率

大类导航
- 作品综合奖
- 角色奖
- 制作奖
- 音乐奖
- 来源与类型奖
- 观众感受奖
- 演出作画奖
- 评选结算奖

奖项卡片区
- 按大类分组展示所有奖项
```

## 奖项体系

```text
作品综合奖
- 最佳动画
- 最佳单集
- 最佳动画电影
- 最佳短篇 / 特别篇

角色奖
- 最佳男主角
- 最佳男配角
- 最佳女主角
- 最佳女配角
- 最佳 CP
- 最佳反派

制作奖
- 最佳监督
- 最佳编剧
- 最佳男声优
- 最佳女声优
- 最佳配乐

音乐奖
- 最佳 OP
- 最佳 ED
- 最佳动画音乐

来源与类型奖
- 最佳原创动画
- 最佳改编动画
- 最佳续作动画
- 最佳恋爱动画
- 最佳喜剧动画
- 最佳治愈动画
- 最佳战斗动画
- 最佳异世界动画

观众感受奖
- 最惊喜动画
- 最失望动画
- 最想安利动画
- 最怪但我喜欢
- 最馊饭团奖
- 最金饭团奖

演出作画奖
- 最佳作画片段
- 最佳演出回
- 最有记忆点场面

评选结算奖
- 最终冠军
- 最大分歧
- 最大共识
- 陪跑王
- 遗珠动画
- 特立独行之选
```

## 奖项类型

每个奖项有不同的产生方式。

```text
AUTO
系统根据已有排名、Elo、Tier、社区聚合结果自动生成。

TAG_AUTO
系统先按标签筛选候选，再根据社区榜或个人榜生成结果。

NOMINATION_VOTE
用户添加候选，社区投票产生获奖者。

MANUAL
Pool 创建者或管理员手动填写结果。

MIXED
系统给出推荐结果，用户和社区可以通过投票修正。
```

## 自动生成奖项

适合直接由现有数据生成：

```text
最佳动画
最终冠军
最大分歧
最大共识
陪跑王
遗珠动画
特立独行之选
```

示例规则：

```text
最佳动画
社区平均排名最高的作品。

最大分歧
排名方差最高，或 Tier 分布跨度最大的作品。

最大共识
高排名占比高、低排名占比低、分布集中的作品。

陪跑王
Top 3 次数高，但第一名次数低的作品。

遗珠动画
少数用户给出极高评价，但社区平均排名不高的作品。

特立独行之选
当前用户排名显著高于社区平均的作品。
```

## 标签生成奖项

适合基于作品标签或元数据筛选：

```text
最佳原创动画
最佳改编动画
最佳续作动画
最佳恋爱动画
最佳喜剧动画
最佳治愈动画
最佳战斗动画
最佳异世界动画
```

系统从 Pool 内筛出对应候选，再按社区结果或用户个人结果生成获奖者。

## 提名投票奖项

适合动画本体之外的细节内容：

```text
最佳单集
最佳男主角
最佳女主角
最佳 CP
最佳反派
最佳监督
最佳编剧
最佳男声优
最佳女声优
最佳 OP
最佳 ED
最佳作画片段
最佳演出回
最有记忆点场面
```

候选支持两种形式：

```text
关联动画候选
animeId + title

纯文本候选
titleText，例如：
- 忍杀 EP5
- 和田 x 山本
- 光死夏 OP
- 花田十辉
```

## 奖项卡片示例

```text
最佳动画

社区获奖：美食广场
我的选择：冲绳妹
提名：美食广场、末日后酒店、一杆青空、冲绳妹

共识度：72%
热区：你比 86% 的人更喜欢冲绳妹。
```

```text
最大分歧

获奖：BanG Dream! Ave Mujica
提名：Ave Mujica、永远的黄昏、藤本树 17-26

分歧度：94%
热区：有人把它供上神坛，也有人直接丢进 D。这个池子最吵的一桌。
```

```text
陪跑王

获奖：末日后酒店
提名：末日后酒店、一杆青空、冲绳妹

热区：它经常冲进前三，但总是在最后一步被别人端走饭团。
```

## 热区文案

每个奖项可以生成一句“热区说明”，用于解释结果为什么有趣。

文案类型：

```text
共识型
多数用户都认可这个结果。

分歧型
用户评价分布很散，争议明显。

独狼型
当前用户选择与社区结果差异很大。

陪跑型
作品经常进入高位，但很少拿第一。

遗珠型
少数用户极高评价，但整体排名不高。

黑马型
社区表现明显高于预期。

反差型
个人结果和社区结果形成强烈对比。
```

## 用户行为

用户可以在颁奖页中：

```text
查看社区获奖结果
查看自己的选择
查看提名名单
添加候选
给候选投票
切换“社区结果 / 我的结果”
查看热区说明
跳转到对应动画详情
从奖项进入相关 Tier List
分享颁奖页
```

## 权限规则

根据 Pool 权限继承：

```text
PRIVATE
仅 Pool 创建者或授权用户可查看和参与。

UNLISTED
拥有链接者可查看，登录用户可参与。

PUBLIC
所有用户可查看，登录用户可参与提名和投票。
```

候选提交权限：

```text
Pool 可编辑者：可添加、编辑、删除候选。
普通参与者：可添加候选，但不能删除他人候选。
管理员：可管理所有候选。
```

投票规则：

```text
每个用户每个奖项默认只能投 1 票。
可以修改自己的投票。
同一奖项下不能重复投多个候选。
```

## 数据模型建议

```text
AwardTemplate
- id
- name
- description
- isDefault
- createdAt
- updatedAt

AwardTemplateCategory
- id
- templateId
- name
- position

AwardTemplateItem
- id
- categoryId
- name
- sourceType
- candidateRule
- winnerRule
- position
```

Pool 实例：

```text
PoolAwardSet
- id
- poolId
- runId?
- templateId
- title
- status
- createdAt
- updatedAt

PoolAwardCategory
- id
- awardSetId
- name
- position

PoolAward
- id
- categoryId
- templateItemId?
- name
- sourceType
- winnerAnimeId?
- winnerText?
- communityWinnerAnimeId?
- communityWinnerText?
- personalWinnerAnimeId?
- personalWinnerText?
- consensusScore?
- divergenceScore?
- heatNote?
- status
- position

PoolAwardNominee
- id
- awardId
- animeId?
- titleText
- description?
- createdByUserId?
- voteCount
- isWinner
- position
- createdAt
- updatedAt

PoolAwardVote
- id
- awardId
- nomineeId
- userId
- createdAt
- updatedAt
```

## 状态设计

```text
PoolAwardSet.status
- DRAFT
- ACTIVE
- LOCKED
- ARCHIVED

PoolAward.status
- READY
- NEED_NOMINATION
- VOTING
- RESOLVED
- INSUFFICIENT_DATA
```

## 结果计算

社区获奖：

```text
AUTO / TAG_AUTO
使用社区聚合榜单、平均排名、Tier 分布、Top 1 次数、Top 3 次数等计算。

NOMINATION_VOTE
使用投票数最高的候选。

MANUAL
使用手动填写结果。
```

我的选择：

```text
AUTO / TAG_AUTO
使用当前用户自己的 run 结果计算。

NOMINATION_VOTE
使用当前用户投票。

MANUAL
若无个人维度，则显示为空或“未选择”。
```

## 分享能力

颁奖页支持分享：

```text
分享整个 Pool Awards 页面
分享单个奖项卡片
生成图片版颁奖结果
```

分享图内容：

```text
Pool 名称
奖项名
社区获奖
我的选择
提名
热区文案
AniMatch 标识
```

## 最终体验

用户完成一个 Pool 的对决后，系统不只给出 Tier List，还生成一页完整的颁奖结果：

```text
谁是最佳动画
谁是最大分歧
谁是遗珠
谁是陪跑
谁最有共识
我的选择和社区哪里不同
哪些角色、OP、单集、场面被大家提名
```

Pool Awards 的目标是让排序结果变成故事，让个人偏好和社区分歧变成可以围观、讨论和分享的内容。
