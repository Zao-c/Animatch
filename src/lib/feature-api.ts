export async function featureRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options,
    headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "请求失败，请重试");
  return result.data as T;
}
