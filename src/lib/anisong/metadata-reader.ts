import { MAX_AUDIO_BYTES } from "./types";
import { filenameMetadata, type LocalSongMetadata } from "./metadata";

// Parsing is optional; cancellation/timeouts terminate the worker, not just its promise.
export function readLocalSongMetadata(file: File, signal?: AbortSignal): Promise<LocalSongMetadata> {
  const fallback = (note: string): LocalSongMetadata => ({ ...filenameMetadata(file.name), cover: null, note });
  if (signal?.aborted) return Promise.resolve(fallback("已跳过自动读取，可手动填写"));
  if (!file.size || file.size > MAX_AUDIO_BYTES) return Promise.resolve(fallback("文件为空或超过20 MB，未读取信息"));
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new Worker(new URL("./metadata.worker.ts", import.meta.url), { type: "module" }); }
    catch { resolve(fallback("当前浏览器无法自动读取，可手动填写")); return; }
    let settled = false;
    const finish = (result: LocalSongMetadata) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate(); resolve(result);
    };
    const abort = () => finish(fallback("已跳过自动读取，可手动填写"));
    const timer = setTimeout(() => finish(fallback("读取超时，已按文件名填写")), 10000);
    worker.onmessage = (event: MessageEvent<LocalSongMetadata>) => finish(event.data);
    worker.onerror = event => { event.preventDefault(); finish(fallback("无法读取标签，已按文件名填写")); };
    worker.onmessageerror = () => finish(fallback("无法读取标签，已按文件名填写"));
    signal?.addEventListener("abort", abort, { once: true });
    try { worker.postMessage(file); } catch { finish(fallback("无法读取文件，可手动填写")); }
  });
}
