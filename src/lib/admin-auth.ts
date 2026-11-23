import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AppError } from "@/lib/app-error";
import { getCurrentUser, requireCurrentUser } from "@/lib/auth-session";
import type { FriendAuthUser } from "@/lib/auth-session";

const ADMIN_COOKIE_NAME = "animatch_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

interface AdminSessionPayload {
  userId: string;
  exp: number;
}

export function isSiteAdminUser(user: FriendAuthUser): boolean {
  const ids = getSiteAdminUserIds();
  return ids.has(user.id);
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  try {
    const cookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
    if (!cookie) {
      return null;
    }

    return verifyAdminSession(cookie);
  } catch {
    return null;
  }
}

export async function requireSiteAdmin(): Promise<FriendAuthUser> {
  const user = await requireCurrentUser();

  if (!isSiteAdminUser(user)) {
    throw new AppError("You are not authorized to access the admin console", 403, "ADMIN_FORBIDDEN");
  }

  const adminSession = await getAdminSession();

  if (adminSession === null) {
    throw new AppError("Admin session required", 401, "ADMIN_SESSION_REQUIRED");
  }

  if (adminSession.userId !== user.id) {
    throw new AppError("Admin session mismatch", 401, "ADMIN_SESSION_MISMATCH");
  }

  return user;
}

export function verifyAdminCode(code: unknown): boolean {
  if (typeof code !== "string") {
    return false;
  }

  const expected = getSiteAdminCode();

  if (expected.length === 0) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(code.trim()), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function createAdminSessionCookie(
  response: NextResponse,
  user: FriendAuthUser
) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: signAdminSession({
      userId: user.id,
      exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: getAdminCookieSecure(),
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getAdminCookieSecure(),
    path: "/",
    maxAge: 0
  });
}

export async function isAdminEditSession(user: FriendAuthUser): Promise<boolean> {
  if (user === null || user === undefined) {
    return false;
  }

  const adminSession = await getAdminSession();
  if (adminSession === null) {
    return false;
  }

  return adminSession.userId === user.id;
}

function getSiteAdminUserIds(): Set<string> {
  const raw = process.env.SITE_ADMIN_USER_IDS;
  if (!raw || raw.trim().length === 0) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  );
}

function getSiteAdminCode(): string {
  const value = process.env.SITE_ADMIN_CODE;
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local-dev-admin-code";
  }

  return "";
}

function getAdminCookieSecure(): boolean {
  const value = process.env.AUTH_COOKIE_SECURE;

  if (value === undefined || value === "") {
    return process.env.NODE_ENV === "production";
  }

  return value.trim().toLowerCase() === "true";
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

function signAdminSession(payload: AdminSessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifyAdminSession(value: string): AdminSessionPayload | null {
  const [encodedPayload, signature, extra] = value.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const expected = createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as AdminSessionPayload;

    if (
      typeof payload.userId !== "string" ||
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

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
