import { NextResponse } from "next/server";

const MAX_SIZE = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
]);

const INTERNAL_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }
  for (const pattern of INTERNAL_IP_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  return false;
}

function pickReferer(hostname: string): string | null {
  if (hostname.endsWith(".bgm.tv") || hostname === "bgm.tv") {
    return "https://bgm.tv/";
  }
  if (hostname.endsWith(".bangumi.tv") || hostname === "bangumi.tv") {
    return "https://bangumi.tv/";
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: "protocol not allowed" }, { status: 400 });
  }

  if (isBlockedHostname(parsed.hostname)) {
    return NextResponse.json({ error: "hostname not allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const referer = pickReferer(parsed.hostname);
  const headers: Record<string, string> = {
    "User-Agent": "AniMatch-ImageProxy/1.0",
    "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
  };
  if (referer !== null) {
    headers["Referer"] = referer;
  }

  let response: Response;

  try {
    response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "upstream timeout"
      : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return NextResponse.json({ error: `upstream returned ${response.status}` }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "not an image" }, { status: 400 });
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_SIZE) {
    return NextResponse.json({ error: "image too large" }, { status: 400 });
  }

  let buffer: ArrayBuffer;

  try {
    buffer = await response.arrayBuffer();
  } catch {
    return NextResponse.json({ error: "read failed" }, { status: 502 });
  }

  if (buffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "image too large" }, { status: 400 });
  }

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Content-Length": String(buffer.byteLength),
    },
  });
}
