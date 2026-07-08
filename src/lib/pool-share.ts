export type ShareablePoolVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export function canSharePoolLink(visibility: ShareablePoolVisibility): boolean {
  return visibility === "PUBLIC" || visibility === "UNLISTED";
}

export function getPoolShareButtonLabel(visibility: ShareablePoolVisibility): string {
  return canSharePoolLink(visibility) ? "分享番组" : "分享前先公开";
}

export function getPoolShareBlockedNotice(): string {
  return "这个番组仍是私有状态，分享链接只有你自己能打开。请先在番组设置里改为未列出或公开。";
}

export function buildPoolShareText(input: {
  name: string;
  url: string;
  visibility: ShareablePoolVisibility;
}): string {
  const accessCopy =
    input.visibility === "UNLISTED"
      ? "知道链接的人可以浏览，登录后即可开始自己的对决。"
      : "打开后登录即可开始对决。";

  return [`AniMatch 番组《${input.name}》`, input.url, accessCopy].join("\n");
}
