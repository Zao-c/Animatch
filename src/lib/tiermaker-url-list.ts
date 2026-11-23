import type { TierMakerImportItemInput } from "./client-api";

export const TIERMAKER_URL_LIST_SOURCE = "tiermaker-url-list";
export const TIERMAKER_URL_LIST_TEMPLATE_NAME = "TierMaker URL List";
export const MAX_TIERMAKER_URL_LIST_ITEMS = 200;

export const TIERMAKER_IMPORT_ASSISTANT_SCRIPT = `(() => {
const urls = [...document.images]
.map((img) => img.currentSrc || img.src)
.filter(Boolean)
.filter((u) => u.includes("tiermaker.com/images/"))
.filter((u) => !/tiermaker-logo|search-icon|favicon|ads/i.test(u));

const unique = [...new Set(urls)];

const text = unique.join("\\n");

if (navigator.clipboard?.writeText) {
navigator.clipboard.writeText(text).then(() => {
alert(\`已复制 \${unique.length} 个 TierMaker 图片链接。请回到 AniMatch 粘贴导入。\`);
}).catch(() => {
console.log(text);
alert(\`找到 \${unique.length} 个链接，但复制失败。链接已输出到 Console，请手动复制。\`);
});
} else {
console.log(text);
alert(\`找到 \${unique.length} 个链接。链接已输出到 Console，请手动复制。\`);
}
})();`;
export const TIERMAKER_AUTO_PARSE_LIMITED_MESSAGE =
  "自动解析被目标网站限制，请使用导入助手脚本复制图片链接。";

export interface TierMakerUrlListItem extends TierMakerImportItemInput {
  title: string;
  imageUrl: string;
  index: number;
  sourceIndex: number;
  sourceUrl: typeof TIERMAKER_URL_LIST_SOURCE;
}

export function parseTierMakerUrlList(input: string): TierMakerUrlListItem[] {
  const seen = new Set<string>();
  const items: TierMakerUrlListItem[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    if (items.length >= MAX_TIERMAKER_URL_LIST_ITEMS) break;

    const parsed = parseTierMakerUrlListLine(rawLine, items.length);
    if (parsed === null) continue;

    const key = normalizeUrlListImageUrl(parsed.imageUrl);
    if (seen.has(key)) continue;

    seen.add(key);
    items.push(parsed);
  }

  return items;
}

export function formatTierMakerAutoParseError(message: string) {
  if (
    message.includes("TierMaker returned status 403") ||
    message.includes("TierMaker returned status 502")
  ) {
    return TIERMAKER_AUTO_PARSE_LIMITED_MESSAGE;
  }

  return message;
}

function parseTierMakerUrlListLine(line: string, index: number): TierMakerUrlListItem | null {
  const value = line.trim();
  if (!value) return null;

  const separatorIndex = value.indexOf("|");
  const titlePart = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : "";
  const urlPart = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : value;

  if (!isSupportedUrl(urlPart)) return null;

  return {
    title: titlePart || titleFromImageUrl(urlPart, index),
    imageUrl: urlPart,
    index,
    sourceIndex: index,
    sourceUrl: TIERMAKER_URL_LIST_SOURCE,
    tags: ["tiermaker", "imported", "url-list"]
  };
}

function isSupportedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrlListImageUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.searchParams.sort();
  return url.toString();
}

function titleFromImageUrl(value: string, index: number) {
  try {
    const url = new URL(value);
    const fileName = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || `TierMaker #${index + 1}`;
  } catch {
    return `TierMaker #${index + 1}`;
  }
}
