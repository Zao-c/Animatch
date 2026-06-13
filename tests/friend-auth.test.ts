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
