const baseUrl = process.env.ANIMATCH_BASE_URL ?? "http://127.0.0.1:3000";
const inviteCode = process.env.ANIMATCH_INVITE_CODE;
const poolId = process.env.ANIMATCH_POOL_ID;
const seasonId = process.env.ANIMATCH_SEASON_ID;
const userCount = Number(process.env.ANIMATCH_PRESSURE_USERS ?? "8");
const rounds = Number(process.env.ANIMATCH_PRESSURE_ROUNDS ?? "4");

if (!inviteCode || !poolId || !seasonId) {
  console.error("Required env: ANIMATCH_INVITE_CODE, ANIMATCH_POOL_ID, ANIMATCH_SEASON_ID");
  process.exit(1);
}

const targetPaths = [
  (poolId, seasonId) => `/api/pools/${poolId}/seasons/${seasonId}`,
  (poolId, seasonId) => `/api/pools/${poolId}/seasons/${seasonId}/match-queue?limit=5`,
  (poolId, seasonId) => `/pools/${poolId}/seasons/${seasonId}/match`
];

const startedAt = Date.now();
const results = [];

function nowMs() {
  return Date.now() - startedAt;
}

async function timed(label, fn) {
  const start = Date.now();
  try {
    const response = await fn();
    const ms = Date.now() - start;
    results.push({ label, status: response.status, ms });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 160)}`);
    }
    return response;
  } catch (error) {
    const ms = Date.now() - start;
    results.push({ label, status: "ERR", ms });
    throw error;
  }
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function runUser(index) {
  const username = `qa-load-${Date.now().toString(36)}-${index}`;
  const loginResponse = await timed(`u${index}:login`, () =>
    fetch(`${baseUrl}/api/auth/friend-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, inviteCode })
    })
  );
  const cookie = cookieHeaderFrom(loginResponse);
  if (!cookie) throw new Error(`u${index}: login did not return auth cookie`);

  for (let round = 0; round < rounds; round += 1) {
    for (const pathFor of targetPaths) {
      const path = pathFor(poolId, seasonId);
      await timed(`u${index}:r${round}:${path}`, () =>
        fetch(`${baseUrl}${path}`, {
          headers: { cookie, "user-agent": "AniMatchReadOnlyPressureCheck/1.0" }
        })
      );
    }
  }
}

console.log(
  JSON.stringify({
    event: "pressure-check-start",
    baseUrl,
    userCount,
    rounds,
    targetCount: targetPaths.length,
    startedAt: new Date().toISOString()
  })
);

const settled = await Promise.allSettled(Array.from({ length: userCount }, (_, index) => runUser(index + 1)));
const failures = settled.filter((result) => result.status === "rejected");
const durations = results.map((result) => result.ms).sort((a, b) => a - b);
const okCount = results.filter((result) => typeof result.status === "number" && result.status >= 200 && result.status < 400).length;

function percentile(values, p) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil((p / 100) * values.length) - 1);
  return values[index];
}

console.log(
  JSON.stringify(
    {
      event: "pressure-check-finish",
      elapsedMs: nowMs(),
      requestCount: results.length,
      okCount,
      failureCount: failures.length,
      p50Ms: percentile(durations, 50),
      p90Ms: percentile(durations, 90),
      p95Ms: percentile(durations, 95),
      maxMs: durations.at(-1) ?? 0,
      statusCounts: results.reduce((acc, result) => {
        acc[result.status] = (acc[result.status] ?? 0) + 1;
        return acc;
      }, {}),
      failures: failures.map((failure) => String(failure.reason?.message ?? failure.reason)).slice(0, 5)
    },
    null,
    2
  )
);

if (failures.length > 0) {
  process.exit(1);
}
