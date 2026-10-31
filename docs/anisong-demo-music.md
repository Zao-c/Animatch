# 免费音乐 UI 验收素材

这组曲目用于本地上传、试听、封面和 Tier List 验收，类型选择「其他」，不作为动画 OP / ED 数据。

## 音乐来源与许可

| 曲目 | 作者 / 来源 | 授权 | 建议试听 |
| --- | --- | --- | --- |
| Cipher | Kevin MacLeod · [原始页面](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 00:35 起，30 秒 |
| Carefree | Kevin MacLeod · [原始页面](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 00:20 起，30 秒 |

作者网站：[incompetech.com](https://incompetech.com)。许可核对日期：2026-10-29；作者页面标注免费署名授权。音频原文件未修改，仅在播放器设置试听区间。几何封面由本项目制作，是演示图，不是官方专辑封面，也不表示作者认可本项目。

再分发这些音乐时，请一并提供作品名称、作者、来源和许可链接；修改音频需说明修改内容。完整许可见上表链接。

## 准备与导入

```sh
node scripts/prepare-anisong-demo.mjs
```

默认输出到 `output/anisong-demo/music/`（已被 Git 忽略），包含两首 MP3、两张 PNG 封面、SVG 源图、`CREDITS.md` 和记录下载地址、字节数、SHA-256 的 `manifest.json`。可传入自定义输出目录。脚本只下载作者公开提供的音频并生成封面，不连接数据库；下载依赖网络，支持环境代理。

1. 在本地预览创建独立音乐曲单，打开「批量导入音频」。
2. 选择两个 MP3，统一类型设为「其他」，核对歌名和作者 Kevin MacLeod。
3. 为两首歌曲分别选择同名 PNG 封面，再导入。
4. 编辑歌曲，按上表设置试听起点，保留 30 秒片段。
5. 进入对决，使用播放按钮或 Q / E 切换试听；点击重播回到片段起点。播放与投票分别操作。

素材及上传仅用于独立本地预览，不会自动写入现有线上曲单。没有接入 iTunes / 网易云 API。
