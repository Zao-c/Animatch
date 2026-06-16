"use client";

import { toPng } from "html-to-image";

const EXPORT_IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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
