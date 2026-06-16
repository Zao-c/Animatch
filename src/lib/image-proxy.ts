export function proxyExternalImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
