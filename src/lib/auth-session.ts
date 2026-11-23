import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "animatch_friend_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const USERNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9_-]{2,24}$/u;

export interface FriendAuthUser {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
}

interface FriendSessionPayload {
  userId: string;
  username: string;
  exp: number;
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
  username: unknown;
  inviteCode: unknown;
}): Promise<FriendAuthUser> {
  const username = normalizeFriendUsername(input.username);
  const inviteCode = typeof input.inviteCode === "string" ? input.inviteCode.trim() : "";

  if (inviteCode !== getFriendInviteCode()) {
    throw new AppError("Invite code is invalid", 401, "INVITE_CODE_INVALID");
  }

  const existing = await prisma.user.findUnique({
    where: {
      username
    },
    select: friendAuthUserSelect
  });

  if (existing !== null) {
    return existing;
  }

  return prisma.user.create({
    data: {
      username,
      name: username
    },
    select: friendAuthUserSelect
  });
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
  image: true
} as const;
