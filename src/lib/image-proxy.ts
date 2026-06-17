const PROXY_PATH = "/api/image-proxy";

export function proxyExternalImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith(PROXY_PATH)) return trimmed;
  return `${PROXY_PATH}?url=${encodeURIComponent(trimmed)}`;
}

export function isProxiedUrl(url: string): boolean {
  return url.startsWith(PROXY_PATH);
}
