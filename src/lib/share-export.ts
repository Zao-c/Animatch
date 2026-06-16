"use client";

import { toPng } from "html-to-image";

const EXPORT_IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const IMAGE_INLINE_CONCURRENCY = 8;

export interface ExportShareCardOptions {
  filename?: string;
  timeoutMs?: number;
}

export async function exportShareCardAsPng(
  container: HTMLElement,
  options: ExportShareCardOptions = {}
): Promise<{ dataUrl: string }> {
  const { timeoutMs = 20000, filename = "animatch-tier" } = options;

  const card = container.querySelector<HTMLElement>(
    "[data-tier-share-card=\"true\"]"
  );

  if (!card) {
    throw new Error("Export container has no share card element.");
  }

  await waitForShareCardImages(card, timeoutMs);
  await inlineShareCardImagesForExport(card, timeoutMs);

  const dataUrl = await toPng(card, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#101310",
    imagePlaceholder: EXPORT_IMAGE_PLACEHOLDER,
    skipAutoScale: true
  });

  if (typeof window !== "undefined") {
    downloadDataUrl(dataUrl, `${filename}.png`);
  }

  return { dataUrl };
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
  const workers = Array.from(
    { length: Math.min(IMAGE_INLINE_CONCURRENCY, images.length) },
    async () => {
      while (cursor < images.length) {
        const image = images[cursor];
        cursor += 1;
        await inlineOneImageForExport(image, timeoutMs);
      }
    }
  );

  await Promise.all(workers);
}

async function inlineOneImageForExport(
  image: HTMLImageElement,
  timeoutMs: number
): Promise<void> {
  const candidates = getExportImageCandidates(image);

  for (const candidate of candidates) {
    const dataUrl = await fetchImageAsDataUrl(candidate, timeoutMs);
    if (dataUrl !== null) {
      image.src = dataUrl;
      image.removeAttribute("srcset");
      image.style.display = "";
      image.dataset.exportInlined = "true";
      return;
    }
  }

  image.src = EXPORT_IMAGE_PLACEHOLDER;
  image.removeAttribute("srcset");
  image.style.display = "none";
  image.dataset.exportInlined = "false";
  console.warn("[share-export] image could not be inlined", {
    candidates
  });
}

function getExportImageCandidates(image: HTMLImageElement): string[] {
  const values = [
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
