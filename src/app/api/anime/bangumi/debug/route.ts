import { ok, fromError, badRequest } from "@/lib/api-response";
import { isAppError } from "@/lib/app-error";
import { requireCurrentUser } from "@/lib/auth-session";
import { getBangumiProxyDiagnostic } from "@/lib/bangumi";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCurrentUser();
  } catch (error) {
    if (isAppError(error)) {
      return fromError(error);
    }
    return badRequest("Authentication required");
  }

  const proxy = getBangumiProxyDiagnostic();

  const hasBangumiAccessToken = Boolean(
    process.env.BANGUMI_ACCESS_TOKEN || process.env.BANGUMI_TOKEN
  );

  return ok({
    nodeVersion: process.version,
    runtime: "nodejs" as const,
    hasBangumiAccessToken,
    rawEnv: {
      HTTPS_PROXY: process.env.HTTPS_PROXY ? "<set>" : "<missing>",
      HTTP_PROXY: process.env.HTTP_PROXY ? "<set>" : "<missing>",
      https_proxy: process.env.https_proxy ? "<set>" : "<missing>",
      http_proxy: process.env.http_proxy ? "<set>" : "<missing>",
    },
    effectiveProxy: {
      hasValidProxy: Boolean(proxy.normalizedUrl),
      sourceEnvKey: proxy.rawKey ?? null,
      protocol: proxy.protocol ?? null,
      hostPresent: proxy.hostPresent,
      portPresent: proxy.portPresent,
      invalidReason: proxy.invalidReason ?? null,
    },
    cwd: process.cwd(),
    platform: process.platform,
  });
}
