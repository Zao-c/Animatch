import * as cheerio from "cheerio";

const MAX_ITEMS = 200;
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_HOSTS = new Set(["tiermaker.com", "www.tiermaker.com"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1"
]);

const BLOCKED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:"
]);

const IGNORE_PATTERNS = [
  /logo/i,
  /avatar/i,
  /icon/i,
  /social/i,
  /tracking/i,
  /pixel/i,
  /tiny/i,
  /badge/i,
  /banner/i,
  /footer/i,
  /header/i
];

export interface TierMakerTemplateItem {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  sourceIndex: number;
}

export interface TierMakerParseResult {
  title: string;
  sourceUrl: string;
  total: number;
  items: TierMakerTemplateItem[];
}

export interface TierMakerFetchResult {
  html: string;
  finalUrl: string;
}

function isPrivateIP(hostname: string): boolean {
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ipv4Pattern.exec(hostname);
  if (match === null) return false;

  const octets = [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
    parseInt(match[4], 10)
  ];

  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 0) return true;

  return false;
}

export function validateTierMakerTemplateUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  for (const protocol of BLOCKED_PROTOCOLS) {
    if (trimmed.toLowerCase().startsWith(protocol)) {
      throw new Error(`URL protocol is not allowed: ${protocol}`);
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Blocked hostname");
  }

  if (isPrivateIP(hostname)) {
    throw new Error("Private IP addresses are not allowed");
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error("URL must point to tiermaker.com");
  }

  if (!parsed.pathname.startsWith("/create/")) {
    throw new Error("URL must be a TierMaker template (path must start with /create/)");
  }

  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  parsed.searchParams.sort();
  return parsed.toString();
}

export async function fetchTierMakerTemplate(url: string): Promise<TierMakerFetchResult> {
  const validatedUrl = validateTierMakerTemplateUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(validatedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "AniMatch/1.0 TierMaker Import Bot"
      }
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("TierMaker request timed out after 15 seconds");
    }
    throw new Error(`Failed to fetch TierMaker template: ${error instanceof Error ? error.message : "Network error"}`);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`TierMaker returned status ${response.status}`);
  }

  const finalUrl = response.url;
  let finalHostname: string;
  try {
    finalHostname = new URL(finalUrl).hostname.toLowerCase();
  } catch {
    throw new Error("TierMaker redirect resulted in an invalid URL");
  }

  if (!ALLOWED_HOSTS.has(finalHostname)) {
    throw new Error("TierMaker redirect pointed to an untrusted host");
  }

  const html = await response.text();
  return { html, finalUrl };
}

export function parseTierMakerTemplate(
  html: string,
  sourceUrl: string
): TierMakerParseResult {
  const $ = cheerio.load(html);

  const title = extractTitle($, sourceUrl);

  const items: TierMakerTemplateItem[] = [];
  const seenUrls = new Set<string>();

  $("img[src]").each((_index, element) => {
    if (items.length >= MAX_ITEMS) return false;

    const el = $(element);
    const rawSrc = el.attr("src") ?? "";

    if (!rawSrc) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(rawSrc, sourceUrl).toString();
    } catch {
      return;
    }

    if (shouldIgnoreImage(absoluteUrl, el)) return;

    if (seenUrls.has(absoluteUrl)) return;
    seenUrls.add(absoluteUrl);

    const itemTitle = extractItemTitle(el, title, items.length);

    items.push({
      title: itemTitle,
      imageUrl: absoluteUrl,
      sourceUrl,
      sourceIndex: items.length
    });
  });

  if (items.length === 0) {
    throw new Error("No images found in the TierMaker template");
  }

  return {
    title,
    sourceUrl,
    total: items.length,
    items
  };
}

function extractTitle($: cheerio.CheerioAPI, sourceUrl: string): string {
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle && ogTitle.trim()) {
    return ogTitle.trim().slice(0, 120);
  }

  const pageTitle = $("title").text();
  if (pageTitle && pageTitle.trim()) {
    return pageTitle.trim().slice(0, 120);
  }

  const h1 = $("h1").first().text();
  if (h1 && h1.trim()) {
    return h1.trim().slice(0, 120);
  }

  const pathParts = sourceUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/create\//, "")
    .split(/[/?#]/);

  const slugPart = pathParts.find((part) => part.length > 3) ?? pathParts[0] ?? "template";
  return slugPart.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120);
}

function extractItemTitle(
  el: cheerio.Cheerio<any>,
  templateName: string,
  fallbackIndex: number
): string {
  const alt = el.attr("alt");
  if (alt && alt.trim() && !/^(image|img|picture|photo)$/i.test(alt.trim())) {
    return alt.trim().slice(0, 120);
  }

  const titleAttr = el.attr("title");
  if (titleAttr && titleAttr.trim() && !/^(image|img|picture|photo)$/i.test(titleAttr.trim())) {
    return titleAttr.trim().slice(0, 120);
  }

  const parentText = el.parent().clone().children().remove().end().text();
  if (parentText && parentText.trim()) {
    return parentText.trim().slice(0, 120);
  }

  const siblingText = el.next().text() || el.prev().text();
  if (siblingText && siblingText.trim()) {
    return siblingText.trim().slice(0, 120);
  }

  const dataName = el.attr("data-name") || el.attr("data-title");
  if (dataName && dataName.trim()) {
    return dataName.trim().slice(0, 120);
  }

  return `${templateName} 项目 ${fallbackIndex + 1}`;
}

function shouldIgnoreImage(
  url: string,
  el: cheerio.Cheerio<any>
): boolean {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.endsWith(".svg")) return true;

  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(lowerUrl)) return true;
  }

  const width = el.attr("width");
  const height = el.attr("height");

  if (width && height) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      if (w < 50 && h < 50) return true;
    }
  }

  const dataRole = el.attr("data-role") || el.attr("role");
  if (dataRole && /logo|icon|avatar/i.test(dataRole)) return true;

  const classes = (el.attr("class") ?? "").toLowerCase();
  if (classes) {
    if (/logo|icon|avatar|social|tracking|pixel/i.test(classes)) return true;
  }

  return false;
}
