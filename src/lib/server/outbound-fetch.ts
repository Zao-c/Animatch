let _cachedDispatcher: unknown = undefined;

interface OutboundFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

const NO_PROXY_DEFAULTS = ["localhost", "127.0.0.1", "::1", "postgres"];

function getNoProxyHosts(): string[] {
  const raw = process.env.NO_PROXY ?? "";
  if (!raw) return NO_PROXY_DEFAULTS;
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function hostMatchesNoProxy(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  const noProxyHosts = getNoProxyHosts();
  return noProxyHosts.some((entry) => {
    if (entry.startsWith(".") && lower.endsWith(entry)) return true;
    return lower === entry || lower.endsWith("." + entry);
  });
}

function resolveProxyUrl(): string | undefined {
  const direct = process.env.ANIMATCH_OUTBOUND_PROXY_URL?.trim();
  if (direct) return direct;
  const httpsProxy = process.env.HTTPS_PROXY?.trim() ?? process.env.https_proxy?.trim();
  if (httpsProxy) return httpsProxy;
  const httpProxy = process.env.HTTP_PROXY?.trim() ?? process.env.http_proxy?.trim();
  if (httpProxy) return httpProxy;
  return undefined;
}

function getProxyEnvDisplay(): string {
  const direct = process.env.ANIMATCH_OUTBOUND_PROXY_URL?.trim();
  if (direct) return "ANIMATCH_OUTBOUND_PROXY_URL=***";
  const httpsProxy = process.env.HTTPS_PROXY?.trim() ?? process.env.https_proxy?.trim();
  if (httpsProxy) return "HTTPS_PROXY=***";
  const httpProxy = process.env.HTTP_PROXY?.trim() ?? process.env.http_proxy?.trim();
  if (httpProxy) return "HTTP_PROXY=***";
  return "none";
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

async function getDispatcher(targetUrl: string): Promise<unknown | undefined> {
  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) return undefined;

  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname;

    if (isLoopback(hostname) || hostMatchesNoProxy(hostname) || hostname.endsWith(".local")) {
      return undefined;
    }

    const { ProxyAgent } = await import("undici");
    if (_cachedDispatcher === undefined) {
      _cachedDispatcher = new (ProxyAgent as new (url: string) => unknown)(proxyUrl);
    }
    return _cachedDispatcher;
  } catch {
    return undefined;
  }
}

export async function outboundFetch(
  url: string,
  options: OutboundFetchOptions = {}
): Promise<{ ok: boolean; status: number; json: <T>() => Promise<T>; text: () => Promise<string> }> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const dispatcher = await getDispatcher(url);

  const fetchOptions: RequestInit & { dispatcher?: unknown } = {
    method: options.method ?? "GET",
    headers: {
      "User-Agent": "AniMatch/0.3 (outbound-fetch)",
      ...options.headers,
    },
    signal: controller.signal,
  };

  if (options.body !== undefined) {
    fetchOptions.body = options.body;
  }

  if (dispatcher !== undefined) {
    fetchOptions.dispatcher = dispatcher;
  }

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const status = response.status;
    const ok = response.ok;

    let bodyText: string | null = null;

    return {
      ok,
      status,
      json: async <T>(): Promise<T> => {
        if (bodyText !== null) return JSON.parse(bodyText);
        bodyText = await response.text();
        return JSON.parse(bodyText);
      },
      text: async (): Promise<string> => {
        if (bodyText !== null) return bodyText;
        bodyText = await response.text();
        return bodyText;
      },
    };
  } catch {
    clearTimeout(timer);
    throw new Error("outbound_fetch_failed");
  }
}

export function getOutboundFetchInfo(): {
  proxyConfigured: boolean;
  proxySource: string;
  noProxyHosts: string[];
} {
  const proxyUrl = resolveProxyUrl();
  return {
    proxyConfigured: proxyUrl !== undefined,
    proxySource: getProxyEnvDisplay(),
    noProxyHosts: getNoProxyHosts(),
  };
}
