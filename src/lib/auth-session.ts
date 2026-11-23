import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/db";

import { hashPassword, passwordInput, recoveryDigest, verifyPassword } from "./password";
import { FRIEND_SHARED_PASSWORD } from "./friend-login-policy";

const COOKIE_NAME = "animatch_friend_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const USERNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9_-]{2,24}$/u;

export interface FriendAuthUser {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
  authVersion?: number;
}

interface FriendSessionPayload {
  userId: string;
  username: string;
  exp: number;
  version?: number;
}

export function normalizeFriendUsername(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("Username is required", 400, "USERNAME_REQUIRED");
  }

  const username = value.trim().normalize("NFKC");
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError(
      "Username must be 2-24 characters and use Chinese, letters, numbers, underscore, or hyphen",
      400,
      "USERNAME_INVALID"
    );
  }

  return username.toLowerCase();
}

export async function loginWithFriendCode(input: {
  username: unknown; inviteCode: unknown; password?: unknown; recoveryCode?: unknown;
}): Promise<FriendAuthUser> {
  const username = normalizeFriendUsername(input.username);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (existing.deletedAt) throw new AppError("账号已注销，无法登录", 410);
    if (typeof input.recoveryCode === "string" && input.recoveryCode && existing.recoveryHash && existing.recoveryExpiresAt && existing.recoveryExpiresAt > new Date()
      && safeEqual(recoveryDigest(input.recoveryCode), existing.recoveryHash)) {
      const passwordHash = await hashPassword(passwordInput(input.password));
      const changed = await prisma.user.updateMany({ where: { id: existing.id, recoveryHash: existing.recoveryHash, recoveryExpiresAt: { gt: new Date() }, authVersion: existing.authVersion },
        data: { passwordHash, recoveryHash: null, recoveryExpiresAt: null, authVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new AppError("恢复码已使用，请重新获取", 409);
      return prisma.user.findUniqueOrThrow({ where: { id: existing.id }, select: friendAuthUserSelect });
    }
    const sharedLogin = typeof input.password === "string" && safeEqual(input.password, FRIEND_SHARED_PASSWORD);
    if (!sharedLogin && (!existing.passwordHash || !await verifyPassword(input.password, existing.passwordHash))) throw new AppError("用户名或密码不正确，可使用页面提示的群共用密码", 401);
    const user = await prisma.user.findFirst({ where: { id: existing.id, authVersion: existing.authVersion, deletedAt: null }, select: friendAuthUserSelect });
    if (!user) throw new AppError("密码刚刚发生变化，请重新登录", 409);
    return user;
  }
  const inviteCode = typeof input.inviteCode === "string" ? input.inviteCode.trim() : "";
  const sharedLogin = typeof input.password === "string" && safeEqual(input.password, FRIEND_SHARED_PASSWORD);
  if (!sharedLogin && !safeEqual(inviteCode, getFriendInviteCode())) throw new AppError("新账号请使用群共用密码，或填写有效的群邀请码", 401);
  const passwordHash = sharedLogin ? null : await hashPassword(passwordInput(input.password));
  return prisma.user.create({ data: { username, name: username, passwordHash, authVersion: 1 }, select: friendAuthUserSelect });
}

export async function changeAccountPassword(userId: string, input: { currentPassword?: unknown; password?: unknown }) {
  const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (existing.deletedAt) throw new AppError("账号已注销，无法修改密码", 410);
  const sharedPassword = typeof input.currentPassword === "string" && safeEqual(input.currentPassword, FRIEND_SHARED_PASSWORD);
  if (existing.passwordHash && !sharedPassword && !await verifyPassword(input.currentPassword, existing.passwordHash)) throw new AppError("当前密码不正确，也可填写群共用密码", 403);
  const passwordHash = await hashPassword(passwordInput(input.password));
  const changed = await prisma.user.updateMany({ where: { id: userId, authVersion: existing.authVersion },
    data: { passwordHash, recoveryHash: null, recoveryExpiresAt: null, authVersion: { increment: 1 } } });
  if (changed.count !== 1) throw new AppError("密码已在其他页面更新，请重新登录", 409);
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: friendAuthUserSelect });
}

export async function getCurrentUser(): Promise<FriendAuthUser | null> {
  const cookie = cookies().get(COOKIE_NAME)?.value;
  const session = verifySession(cookie);

  if (session === null) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: session.userId,
      authVersion: session.version ?? 0,
      deletedAt: null
    },
    select: friendAuthUserSelect
  });
}

export async function requireCurrentUser(): Promise<FriendAuthUser> {
  const user = await getCurrentUser();

  if (user === null) {
    throw new AppError("Authentication required", 401, "AUTH_REQUIRED");
  }

  return user;
}

export function setAuthCookie(response: NextResponse, user: FriendAuthUser) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: signSession({
      userId: user.id,
      version: user.authVersion ?? 0,
      username: user.username ?? user.id,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthCookieSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthCookieSecure(),
    path: "/",
    maxAge: 0
  });
}

export function getAuthCookieSecure(): boolean {
  const value = process.env.AUTH_COOKIE_SECURE;

  if (value === undefined || value === "") {
    return process.env.NODE_ENV === "production";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new AppError(
    "AUTH_COOKIE_SECURE must be true or false",
    500,
    "AUTH_COOKIE_SECURE_INVALID"
  );
}

export function signSession(payload: FriendSessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySession(value: string | undefined): FriendSessionPayload | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature, extra] = value.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const expected = createSignature(encodedPayload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as FriendSessionPayload;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version < 0)) ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getFriendInviteCode(): string {
  const value = process.env.FRIEND_INVITE_CODE;
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== "production") {
    return "33989";
  }

  throw new AppError("FRIEND_INVITE_CODE is not configured", 500, "INVITE_CODE_MISSING");
}

function getAuthSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== "production") {
    return "animatch-local-dev-auth-secret";
  }

  throw new AppError("AUTH_SECRET is not configured", 500, "AUTH_SECRET_MISSING");
}

function createSignature(encodedPayload: string): string {
  return createHmac("sha256", getAuthSecret()).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

const friendAuthUserSelect = {
  id: true,
  username: true,
  name: true,
  image: true,
  authVersion: true
} as const;
