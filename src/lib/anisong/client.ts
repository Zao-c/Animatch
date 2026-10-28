export class SongApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function songRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new SongApiError(
    response.status === 401 ? "请先登录，再创建或继续你的音乐对决。" : payload?.error?.message || "请求失败，请稍后重试", response.status);
  return payload.data as T;
}
export function downloadSongFile(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
