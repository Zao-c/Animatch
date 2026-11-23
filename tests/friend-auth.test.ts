import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as FRIEND_LOGIN } from "../src/app/api/auth/friend-login/route";
import { POST as LOGOUT } from "../src/app/api/auth/logout/route";
import {
  clearAuthCookie,
  getAuthCookieSecure,
  loginWithFriendCode,
  setAuthCookie,
  signSession,
  verifySession
} from "../src/lib/auth-session";
import { prisma } from "../src/lib/db";
import { resetFriendLoginRateLimitForTests } from "../src/lib/friend-login-rate-limit";

vi.mock("../src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    }
  }
}));

const mockedUser = vi.mocked(prisma.user);

describe("friend auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    process.env.FRIEND_INVITE_CODE = "33989";
    process.env.AUTH_SECRET = "test-secret";
    delete process.env.AUTH_COOKIE_SECURE;
    resetFriendLoginRateLimitForTests();
  });

  it("shows the invite-code help copy on the login page", () => {
    const loginSource = readFileSync("src/app/login/page.tsx", "utf8");

    expect(loginSource).toContain("没有好友暗号？请向邀请你的人索取。");
  });

  it("creates a user when the invite code is correct", async () => {
    mockedUser.findUnique.mockResolvedValue(null);
    mockedUser.create.mockResolvedValue({
      id: "user-1",
      username: "akira",
      name: "akira",
      image: null
    } as any);

    const user = await loginWithFriendCode({
      username: "Akira",
      inviteCode: "33989"
    });

    expect(user).toMatchObject({
      id: "user-1",
      username: "akira"
    });
    expect(mockedUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          username: "akira",
          name: "akira"
        }
      })
    );
  });

  it("reuses an existing username", async () => {
    mockedUser.findUnique.mockResolvedValue({
      id: "user-1",
      username: "akira",
      name: "akira",
      image: null
    } as any);

    const user = await loginWithFriendCode({
      username: "akira",
      inviteCode: "33989"
    });

    expect(user.id).toBe("user-1");
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid invite code", async () => {
    await expect(
      loginWithFriendCode({
        username: "akira",
        inviteCode: "wrong"
      })
    ).rejects.toMatchObject({
      statusCode: 401
    });
  });

  it("rejects an invalid username", async () => {
    await expect(
      loginWithFriendCode({
        username: "a",
        inviteCode: "33989"
      })
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("sets an httpOnly session cookie on login", async () => {
    mockedUser.findUnique.mockResolvedValue({
      id: "user-1",
      username: "akira",
      name: "akira",
      image: null
    } as any);

    const response = await FRIEND_LOGIN(
      new Request("http://test.local/api/auth/friend-login", {
        method: "POST",
        body: JSON.stringify({
          username: "akira",
          inviteCode: "33989"
        })
      })
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("animatch_friend_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rate limits repeated friend-login failures", async () => {
    for (let index = 0; index < 7; index += 1) {
      const response = await FRIEND_LOGIN(friendLoginRequest("192.0.2.10", "akira", "wrong"));
      expect(response.status).toBe(401);
    }

    const blockedResponse = await FRIEND_LOGIN(friendLoginRequest("192.0.2.10", "akira", "wrong"));
    const payload = await blockedResponse.json();

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers.get("Retry-After")).toBeTruthy();
    expect(payload.error.message).toBe("尝试次数过多，请稍后再试。");
  });

  it("clears friend-login failures after a successful login", async () => {
    for (let index = 0; index < 7; index += 1) {
      const response = await FRIEND_LOGIN(friendLoginRequest("192.0.2.11", "akira", "wrong"));
      expect(response.status).toBe(401);
    }

    mockedUser.findUnique.mockResolvedValue({
      id: "user-1",
      username: "akira",
      name: "akira",
      image: null
    } as any);

    const successResponse = await FRIEND_LOGIN(friendLoginRequest("192.0.2.11", "akira", "33989"));
    expect(successResponse.status).toBe(200);

    for (let index = 0; index < 7; index += 1) {
      const response = await FRIEND_LOGIN(friendLoginRequest("192.0.2.11", "akira", "wrong"));
      expect(response.status).toBe(401);
    }
  });

  it("clears the session cookie on logout", async () => {
    const response = await LOGOUT();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain("animatch_friend_session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("uses secure cookies by default in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.AUTH_COOKIE_SECURE;

    expect(getAuthCookieSecure()).toBe(true);
    expect(cookieFromSet()).toContain("Secure");
    expect(cookieFromClear()).toContain("Secure");
  });

  it("allows HTTP deployments to disable secure cookies explicitly", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_COOKIE_SECURE = "false";

    expect(getAuthCookieSecure()).toBe(false);
    expect(cookieFromSet()).not.toContain("Secure");
    expect(cookieFromClear()).not.toContain("Secure");
  });

  it("allows HTTPS deployments to enable secure cookies explicitly", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.AUTH_COOKIE_SECURE = "true";

    expect(getAuthCookieSecure()).toBe(true);
    expect(cookieFromSet()).toContain("Secure");
    expect(cookieFromClear()).toContain("Secure");
  });

  it("rejects invalid AUTH_COOKIE_SECURE values", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_COOKIE_SECURE = "maybe";

    expect(() => getAuthCookieSecure()).toThrow("AUTH_COOKIE_SECURE must be true or false");
  });

  it("verifies signed sessions and rejects tampered or expired sessions", () => {
    const session = signSession({
      userId: "user-1",
      username: "akira",
      exp: Math.floor(Date.now() / 1000) + 60
    });

    expect(verifySession(session)).toMatchObject({
      userId: "user-1",
      username: "akira"
    });
    expect(verifySession(`${session}x`)).toBeNull();
    expect(
      verifySession(
        signSession({
          userId: "user-1",
          username: "akira",
          exp: Math.floor(Date.now() / 1000) - 60
        })
      )
    ).toBeNull();
  });
});

function cookieFromSet() {
  const response = NextResponse.json({ ok: true });
  setAuthCookie(response, {
    id: "user-1",
    username: "akira",
    name: "akira",
    image: null
  });

  return response.headers.get("set-cookie") ?? "";
}

function cookieFromClear() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);

  return response.headers.get("set-cookie") ?? "";
}

function friendLoginRequest(ip: string, username: string, inviteCode: string) {
  return new Request("http://test.local/api/auth/friend-login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip
    },
    body: JSON.stringify({
      username,
      inviteCode
    })
  });
}
