export function resolveProxyUrl() {
  const direct = (process.env.ANIMATCH_OUTBOUND_PROXY_URL ?? "").trim();
  if (direct) return direct;
  const httpsProxy = (process.env.HTTPS_PROXY ?? process.env.https_proxy ?? "").trim();
  if (httpsProxy) return httpsProxy;
  const httpProxy = (process.env.HTTP_PROXY ?? process.env.http_proxy ?? "").trim();
  if (httpProxy) return httpProxy;
  return undefined;
}

const NO_PROXY_DEFAULTS = ["localhost", "127.0.0.1", "::1", "postgres"];

export function getNoProxyHosts() {
  const raw = process.env.NO_PROXY ?? "";
  if (!raw) return NO_PROXY_DEFAULTS;
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function hostMatchesNoProxy(hostname) {
  const lower = hostname.toLowerCase();
  const noProxyHosts = getNoProxyHosts();
  return noProxyHosts.some((entry) => {
    if (entry.startsWith(".") && lower.endsWith(entry)) return true;
    return lower === entry || lower.endsWith("." + entry);
  });
}
