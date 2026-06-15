import { ok, fromError, badRequest } from "@/lib/api-response";
import { isAppError } from "@/lib/app-error";
import { requireCurrentUser } from "@/lib/auth-session";
import { getBangumiProxyUrl } from "@/lib/bangumi";

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

  const proxyUrl = getBangumiProxyUrl();
  let proxyDiagnostic: {
    hasHttpProxy: boolean;
    hasHttpsProxy: boolean;
    proxyProtocol: string | null;
    proxyHostPresent: boolean;
    proxyPortPresent: boolean;
    envHttpsProxyRedacted: string;
    envHttpProxyRedacted: string;
  };

  if (proxyUrl) {
    try {
      const p = new URL(proxyUrl);
      proxyDiagnostic = {
        hasHttpProxy: proxyUrl.startsWith("http://"),
        hasHttpsProxy: proxyUrl.startsWith("https://"),
        proxyProtocol: p.protocol,
        proxyHostPresent: Boolean(p.hostname),
        proxyPortPresent: Boolean(p.port),
        envHttpsProxyRedacted: process.env.HTTPS_PROXY ? "<set>" : "<missing>",
        envHttpProxyRedacted: process.env.HTTP_PROXY ? "<set>" : "<missing>",
      };
    } catch {
      proxyDiagnostic = {
        hasHttpProxy: false,
        hasHttpsProxy: false,
        proxyProtocol: null,
        proxyHostPresent: false,
        proxyPortPresent: false,
        envHttpsProxyRedacted: process.env.HTTPS_PROXY ? "<set>" : "<missing>",
        envHttpProxyRedacted: process.env.HTTP_PROXY ? "<set>" : "<missing>",
      };
    }
  } else {
    proxyDiagnostic = {
      hasHttpProxy: false,
      hasHttpsProxy: false,
      proxyProtocol: null,
      proxyHostPresent: false,
      proxyPortPresent: false,
      envHttpsProxyRedacted: process.env.HTTPS_PROXY ? "<set>" : "<missing>",
      envHttpProxyRedacted: process.env.HTTP_PROXY ? "<set>" : "<missing>",
    };
  }

  const hasBangumiAccessToken = Boolean(
    process.env.BANGUMI_ACCESS_TOKEN || process.env.BANGUMI_TOKEN
  );

  return ok({
    nodeVersion: process.version,
    runtime: "nodejs" as const,
    hasBangumiAccessToken,
    ...proxyDiagnostic,
    cwd: process.cwd(),
    platform: process.platform,
  });
}
