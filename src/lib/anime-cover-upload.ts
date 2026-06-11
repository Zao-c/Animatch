import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export const ANIME_COVER_UPLOAD_PUBLIC_PREFIX = "/uploads/anime-covers/";
export const MAX_ANIME_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export function getAnimeCoverUploadDir() {
  return (
    process.env.ANIMATCH_ANIME_COVER_UPLOAD_DIR ??
    path.join(process.cwd(), "public", "uploads", "anime-covers")
  );
}

export function isAllowedAnimeCoverMimeType(type: string) {
  return Object.prototype.hasOwnProperty.call(MIME_EXTENSION, type);
}

export function isLocalAnimeCoverPath(value: string | null | undefined): value is string {
  if (value === null || value === undefined) {
    return false;
  }

  if (!value.startsWith(ANIME_COVER_UPLOAD_PUBLIC_PREFIX)) {
    return false;
  }

  const fileName = value.slice(ANIME_COVER_UPLOAD_PUBLIC_PREFIX.length);
  return /^[a-zA-Z0-9._-]+$/.test(fileName) && !fileName.includes("..");
}

export function isAllowedCoverOverrideUrl(value: string): boolean {
  if (isLocalAnimeCoverPath(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function localAnimeCoverPublicPathToFilePath(publicPath: string) {
  if (!isLocalAnimeCoverPath(publicPath)) {
    return null;
  }

  const fileName = publicPath.slice(ANIME_COVER_UPLOAD_PUBLIC_PREFIX.length);
  return path.join(getAnimeCoverUploadDir(), fileName);
}

export async function saveAnimeCoverUpload({
  file,
  poolId,
  animeId
}: {
  file: File;
  poolId: string;
  animeId: string;
}) {
  const extension = MIME_EXTENSION[file.type];

  if (extension === undefined) {
    throw new AnimeCoverUploadError("Only jpg, png, webp, and gif images are supported", 400);
  }

  if (file.size > MAX_ANIME_COVER_UPLOAD_BYTES) {
    throw new AnimeCoverUploadError("Cover image must be 5MB or smaller", 413);
  }

  const safePoolId = safeNamePart(poolId);
  const safeAnimeId = safeNamePart(animeId);
  const fileName = `${safePoolId}-${safeAnimeId}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const uploadDir = getAnimeCoverUploadDir();
  const filePath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return `${ANIME_COVER_UPLOAD_PUBLIC_PREFIX}${fileName}`;
}

export async function deleteLocalAnimeCoverIfPresent(value: string | null | undefined) {
  const filePath = value === undefined || value === null ? null : localAnimeCoverPublicPathToFilePath(value);

  if (filePath === null) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    console.warn("Failed to delete local anime cover upload", error);
  }
}

export class AnimeCoverUploadError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function safeNamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "item";
}
