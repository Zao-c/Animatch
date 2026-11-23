import { AppError } from "./app-error";
export const awardHeaders = { "Cache-Control": "private, no-store" };
export async function awardBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("请使用 JSON 请求", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("请求内容为空", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 512_000) { await reader.cancel(); throw new AppError("提名内容过长", 413); }
      chunks.push(chunk.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new AppError("请求格式不正确", 400); }
  } finally { reader.releaseLock(); }
}
