const PROXY_PATH = "/api/image-proxy";
const warmedProxyUrls = new Set<string>();

export function proxyExternalImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith(PROXY_PATH)) return trimmed;
  if (isDirectImageUrl(trimmed)) return trimmed;
  return `${PROXY_PATH}?url=${encodeURIComponent(trimmed)}`;
}

export function isProxiedUrl(url: string): boolean {
  return url.startsWith(PROXY_PATH);
}

export function isRemoteImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function isDirectImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const directHosts = [
    process.env.NEXT_PUBLIC_DIRECT_IMAGE_HOSTS,
    hostFromPublicBaseUrl(process.env.NEXT_PUBLIC_COS_PUBLIC_BASE_URL)
  ]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return directHosts.includes(parsed.hostname.toLowerCase());
}

function hostFromPublicBaseUrl(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value.trim()).hostname;
  } catch {
    return "";
  }
}

export function warmImageProxyCache(url: string | null | undefined): void {
  if (typeof window === "undefined" || !isRemoteImageUrl(url)) {
    return;
  }

  const proxiedUrl = proxyExternalImageUrl(url);
  if (proxiedUrl === null || proxiedUrl === url || warmedProxyUrls.has(proxiedUrl)) {
    return;
  }

  warmedProxyUrls.add(proxiedUrl);
  window.setTimeout(() => {
    fetch(proxiedUrl, {
      cache: "force-cache",
      credentials: "same-origin"
    }).catch(() => {
      warmedProxyUrls.delete(proxiedUrl);
    });
  }, 0);
}

export function getProxiedCoverCandidates(
  primary: string | null | undefined,
  secondary: string | null | undefined
): string[] {
  const values = [
    proxyExternalImageUrl(primary),
    proxyExternalImageUrl(secondary)
  ];

  const seen = new Set<string>();
  return values.flatMap((url) => {
    if (!url) return [];
    if (seen.has(url)) return [];
    seen.add(url);
    return [url];
  });
}
