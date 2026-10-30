import COS from "cos-nodejs-sdk-v5";
import { AppError } from "@/lib/app-error";

type CosAudioConfig = { secretId: string; secretKey: string; bucket: string; region: string; prefix: string; publicBaseUrl: string };
function config(): CosAudioConfig | null {
  const secretId = process.env.ANISONG_COS_SECRET_ID?.trim();
  const secretKey = process.env.ANISONG_COS_SECRET_KEY?.trim();
  const bucket = process.env.ANISONG_COS_BUCKET?.trim();
  const region = process.env.ANISONG_COS_REGION?.trim();
  if (!secretId && !secretKey && !bucket && !region) return null;
  if (!secretId || !secretKey || !bucket || !region || !/^[a-z0-9-]+$/.test(bucket) || !/^[a-z0-9-]+$/.test(region)) throw new AppError("AniMatch 音频 COS 配置不完整", 503);
  const prefix = (process.env.ANISONG_COS_PREFIX || "AniMatch/audio-pool").replace(/^\/+|\/+$/g, "");
  if (!prefix.split("/").every(part => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..")) throw new AppError("AniMatch 音频 COS 前缀无效", 503);
  const defaultBase = `https://${bucket}.cos.${region}.myqcloud.com`;
  let publicBaseUrl = defaultBase;
  if (process.env.ANISONG_COS_PUBLIC_BASE_URL?.trim()) {
    try {
      const url = new URL(process.env.ANISONG_COS_PUBLIC_BASE_URL.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) throw new Error("invalid");
      publicBaseUrl = url.href.replace(/\/$/, "");
    } catch { throw new AppError("AniMatch 音频 COS 公网地址无效", 503); }
  }
  return { secretId, secretKey, bucket, region, prefix, publicBaseUrl };
}
export function isCosAudioConfigured() { return config() !== null; }
export function cosAudioObjectKey(key: string) {
  if (!/^[a-f0-9]{64}\.(mp3|m4a|wav|ogg|flac)$/.test(key)) throw new AppError("公共音频编号无效", 400);
  const current = config();
  if (!current) throw new AppError("AniMatch 音频 COS 尚未配置", 503);
  return `${current.prefix}/${key}`;
}
export function cosAudioPublicUrl(key: string) {
  const current = config();
  if (!current) throw new AppError("AniMatch 音频 COS 尚未配置", 503);
  return `${current.publicBaseUrl}/${cosAudioObjectKey(key).split("/").map(encodeURIComponent).join("/")}`;
}
function client(current: CosAudioConfig) { return new COS({ SecretId: current.secretId, SecretKey: current.secretKey, Timeout: 20000 }); }
export async function cosAudioObjectExists(key: string) {
  const current = config();
  if (!current) return false;
  const objectKey = cosAudioObjectKey(key);
  try {
    await new Promise<void>((resolve, reject) => client(current).headObject({ Bucket: current.bucket, Region: current.region, Key: objectKey }, error => error ? reject(error) : resolve()));
    return true;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 403) return false;
    throw new AppError("AniMatch 音频 COS 暂时无法连接", 502);
  }
}
export async function putCosAudioObject(key: string, mime: string, bytes: Uint8Array) {
  const current = config();
  if (!current) throw new AppError("AniMatch 音频 COS 尚未配置", 503);
  const objectKey = cosAudioObjectKey(key);
  try {
    await new Promise<void>((resolve, reject) => client(current).putObject({
      Bucket: current.bucket, Region: current.region, Key: objectKey, Body: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), ContentType: mime,
      CacheControl: "public, max-age=31536000, immutable", ACL: "public-read"
    }, error => error ? reject(error) : resolve()));
  } catch { throw new AppError("公共音频上传 COS 失败，请稍后重试", 502); }
}
