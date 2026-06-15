const FRIEND_LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FRIEND_LOGIN_MAX_FAILURES = 8;

type FailureRecord = {
  count: number;
  resetAt: number;
};

const failedLoginAttempts = new Map<string, FailureRecord>();

export type FriendLoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function getFriendLoginRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip = forwardedFor || realIp || "unknown";

  return `friend-login:${ip}`;
}

export function checkFriendLoginRateLimit(
  key: string,
  now = Date.now()
): FriendLoginRateLimitResult {
  const record = failedLoginAttempts.get(key);
  if (record === undefined) {
    return { allowed: true };
  }

  if (record.resetAt <= now) {
    failedLoginAttempts.delete(key);
    return { allowed: true };
  }

  if (record.count >= FRIEND_LOGIN_MAX_FAILURES) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(record.resetAt, now)
    };
  }

  return { allowed: true };
}

export function recordFriendLoginFailure(
  key: string,
  now = Date.now()
): FriendLoginRateLimitResult {
  const existing = failedLoginAttempts.get(key);
  const record =
    existing === undefined || existing.resetAt <= now
      ? { count: 0, resetAt: now + FRIEND_LOGIN_WINDOW_MS }
      : existing;

  record.count += 1;
  failedLoginAttempts.set(key, record);

  return checkFriendLoginRateLimit(key, now);
}

export function clearFriendLoginFailures(key: string): void {
  failedLoginAttempts.delete(key);
}

export function resetFriendLoginRateLimitForTests(): void {
  failedLoginAttempts.clear();
}

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
