import { stat, readFile } from "fs/promises";
import path from "path";

import { getAnimeCoverUploadDir, getCustomItemUploadDir } from "@/lib/anime-cover-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function resolveUploadDir(segment: string): string | null {
  if (segment === "custom-items") {
    return getCustomItemUploadDir();
  }
  if (segment === "anime-covers") {
    return getAnimeCoverUploadDir();
  }
  return null;
}

/**
 * Serves files from the local upload directories.
 *
 * Next.js only registers `public/` files that exist when the server starts, so
 * files uploaded at runtime would 404 until the next restart. This catch-all
 * route picks up those requests (the static handler still wins for files that
 * were present at boot) and streams them straight from disk.
 */
export async function GET(
  _request: Request,
  { params }: { params: { path: string[] } }
) {
  const segments = params.path ?? [];
  if (segments.length !== 2) {
    return new Response("Not found", { status: 404 });
  }

  const [directory, fileName] = segments;
  const uploadDir = resolveUploadDir(directory);
  if (uploadDir === null || !/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()];
  if (contentType === undefined) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(uploadDir, fileName);

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Last-Modified": info.mtime.toUTCString()
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
