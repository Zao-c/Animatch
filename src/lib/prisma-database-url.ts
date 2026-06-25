const DEFAULT_PRISMA_CONNECTION_LIMIT = "10";
const DEFAULT_PRISMA_POOL_TIMEOUT = "5";

export function buildPrismaDatabaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? DEFAULT_PRISMA_CONNECTION_LIMIT);
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? DEFAULT_PRISMA_POOL_TIMEOUT);
    }
    return url.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      connection_limit: process.env.PRISMA_CONNECTION_LIMIT ?? DEFAULT_PRISMA_CONNECTION_LIMIT,
      pool_timeout: process.env.PRISMA_POOL_TIMEOUT ?? DEFAULT_PRISMA_POOL_TIMEOUT
    });
    return `${rawUrl}${separator}${params.toString()}`;
  }
}
