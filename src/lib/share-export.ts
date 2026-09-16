"use client";

import { toPng } from "html-to-image";
import { isRemoteImageUrl } from "./image-proxy";

const EXPORT_IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const IMAGE_INLINE_CONCURRENCY = 4;
const IMAGE_REQUEST_TIMEOUT_MS = 8000;

export function getExportPixelRatio(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("榜单尺寸无效，请等待页面加载完成后重试。");
  }
  // Limit both dimensions and total canvas memory, including on mobile Safari.
  return Math.min(2, 4096 / width, 4096 / height, Math.sqrt(8_000_000 / (width * height)));
}

export interface ExportShareCardOptions {
  filename?: string;
  timeoutMs?: number;
}

export async function exportShareCardAsPng(
  container: HTMLElement,
  options: ExportShareCardOptions = {}
): Promise<{ dataUrl: string }> {
  const { timeoutMs = 30000, filename = "animatch-tier" } = options;

  const card = container.querySelector<HTMLElement>(
    "[data-tier-share-card=\"true\"]"
  );

  if (!card) {
    throw new Error("Export container has no share card element.");
  }

  // Work on an isolated copy: React must not remove or replace images while
  // they are being fetched, decoded and captured.
  const clone = card.cloneNode(true) as HTMLElement;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;pointer-events:none;";
  clone.style.width = "1280px";
  host.appendChild(clone);

  try {
    // Inline before attaching so hundreds of eager images do not issue an
    // uncontrolled second set of browser requests.
    await inlineShareCardImagesForExport(clone, timeoutMs);
    document.body.appendChild(host);
    await waitForShareCardImages(clone, 3000);
    const undecoded = Array.from(clone.querySelectorAll("img")).filter(
      (image) => !image.complete || image.naturalWidth === 0
    );
    if (undecoded.length > 0) {
      throw new Error(`${undecoded.length} 张封面未能解码，请重试导出。`);
    }
    const width = Math.ceil(clone.scrollWidth);
    const height = Math.ceil(clone.scrollHeight);
    const dataUrl = await toPng(clone, {
      cacheBust: false,
      includeQueryParams: true,
      pixelRatio: getExportPixelRatio(width, height),
      width,
      height,
      backgroundColor: "#101310",
      imagePlaceholder: EXPORT_IMAGE_PLACEHOLDER,
      skipFonts: true,
      skipAutoScale: false
    });
    if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length < 100) {
      throw new Error("浏览器未能生成有效图片，请减少榜单作品数量后重试。");
    }
    downloadDataUrl(dataUrl, `${filename}.png`);
    return { dataUrl };
  } finally {
    host.remove();
  }
}

export async function inlineShareCardImagesForExport(
  card: HTMLElement,
  timeoutMs: number = 15000
): Promise<void> {
  const images = Array.from(card.querySelectorAll<HTMLImageElement>("img"));

  if (images.length === 0) {
    return;
  }

  let cursor = 0;
  let failedCount = 0;
  const deadline = Date.now() + timeoutMs;
  const downloads = new Map<string, Promise<string | null>>();
  const fetchOnce = (url: string) => {
    let result = downloads.get(url);
    if (!result) {
      const remainingMs = deadline - Date.now();
      result = remainingMs <= 0 ? Promise.resolve(null) :
        fetchImageAsDataUrl(url, Math.min(IMAGE_REQUEST_TIMEOUT_MS, remainingMs));
      downloads.set(url, result);
    }
    return result;
  };
  const workers = Array.from(
    { length: Math.min(IMAGE_INLINE_CONCURRENCY, images.length) },
    async () => {
      while (cursor < images.length) {
        const image = images[cursor];
        cursor += 1;
        if (!await inlineOneImageForExport(image, fetchOnce)) failedCount += 1;
      }
    }
  );

  await Promise.all(workers);
  if (failedCount > 0) {
    throw new Error(`${failedCount} 张封面暂时无法读取，已取消导出以避免缺图。请稍后重试。`);
  }
}

async function inlineOneImageForExport(
  image: HTMLImageElement,
  fetchOnce: (url: string) => Promise<string | null>
): Promise<boolean> {
  const candidates = getExportImageCandidates(image);

  for (const candidate of candidates) {
    const dataUrl = await fetchOnce(candidate);
    if (dataUrl !== null) {
      image.src = dataUrl;
      image.removeAttribute("srcset");
      image.style.display = "";
      image.style.opacity = "1";
      image.style.transition = "none";
      image.loading = "eager";
      image.dataset.exportInlined = "true";
      return true;
    }
  }

  image.src = EXPORT_IMAGE_PLACEHOLDER;
  image.removeAttribute("srcset");
  image.style.display = "none";
  image.dataset.exportInlined = "false";
  console.warn("[share-export] image could not be inlined", {
    candidates
  });
  return false;
}

function getExportImageCandidates(image: HTMLImageElement): string[] {
  const values = [
    image.dataset.exportSrc,
    image.currentSrc,
    image.src,
    image.dataset.exportSecondarySrc,
    getOriginalUrlFromImageProxy(image.currentSrc || image.src)
  ];
  const seen = new Set<string>();

  return values.flatMap((value) => {
    if (value === undefined || value === null) {
      return [];
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      return [];
    }

    seen.add(trimmed);
    // A COS image can display in <img> without CORS while fetch cannot read it.
    // Same-origin proxy is an export-only fallback, keeping normal views on COS.
    if (isRemoteImageUrl(trimmed)) {
      const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
      const parsed = new URL(trimmed);
      if (parsed.origin !== origin) {
        const proxy = `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
        if (!seen.has(proxy)) {
          seen.add(proxy);
          return [trimmed, proxy];
        }
      }
    }
    return [trimmed];
  });
}

function getOriginalUrlFromImageProxy(value: string): string | null {
  try {
    const parsed = new URL(value, window.location.href);
    if (parsed.pathname !== "/api/image-proxy") {
      return null;
    }

    return parsed.searchParams.get("url");
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrl(
  value: string,
  timeoutMs: number
): Promise<string | null> {
  if (value.startsWith("data:image/")) {
    return value;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(value, {
      cache: "force-cache",
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn("[share-export] image fetch failed", {
        src: value,
        status: response.status
      });
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      console.warn("[share-export] image fetch returned non-image", {
        src: value,
        contentType
      });
      return null;
    }

    const blob = await response.blob();
    if (blob.size === 0 || blob.size > 10 * 1024 * 1024) return null;
    return await blobToDataUrl(blob, contentType);
  } catch (error) {
    console.warn("[share-export] image fetch threw", {
      src: value,
      message: error instanceof Error ? error.message : "unknown error"
    });
    return null;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function blobToDataUrl(blob: Blob, fallbackContentType: string): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${blob.type || fallbackContentType};base64,${btoa(binary)}`;
}

export async function waitForShareCardImages(
  card: HTMLElement,
  timeoutMs: number = 15000
): Promise<void> {
  const images = Array.from(card.querySelectorAll<HTMLImageElement>("img"));

  if (images.length === 0) {
    return;
  }

  const deadline = Date.now() + timeoutMs;

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          let settled = false;

          const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          };

          const cleanup = () => {
            img.removeEventListener("load", handleLoad);
            img.removeEventListener("error", handleError);
            clearTimeout(timer);
          };

          const handleLoad = () => {
            if (img.naturalWidth > 0) {
              finish();
            }
          };

          const handleError = () => {
            const failedSrc = img.currentSrc || img.src;
            console.warn("[share-export] image failed", {
              src: failedSrc
            });
            globalThis.setTimeout(() => {
              const nextSrc = img.currentSrc || img.src;
              if (nextSrc !== failedSrc && img.complete && img.naturalWidth > 0) {
                finish();
                return;
              }

              if (nextSrc !== failedSrc && !img.complete) {
                return;
              }

              finish();
            }, 80);
          };

          const timer = setTimeout(() => {
            console.warn("[share-export] image timed out", {
              src: img.currentSrc || img.src
            });
            finish();
          }, Math.max(0, deadline - Date.now()));

          img.addEventListener("load", handleLoad, { once: true });
          img.addEventListener("error", handleError, { once: true });
          img.loading = "eager";

          if (img.complete) {
            if (img.naturalWidth > 0) {
              finish();
            }
          }
        })
    )
  );
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
