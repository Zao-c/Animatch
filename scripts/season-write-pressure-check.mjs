const baseUrl = process.env.ANIMATCH_BASE_URL ?? "http://127.0.0.1:3000";
const inviteCode = process.env.ANIMATCH_INVITE_CODE;
const sourcePoolId = process.env.ANIMATCH_SOURCE_POOL_ID;
const userCount = Number(process.env.ANIMATCH_PRESSURE_USERS ?? "5");
const votesPerUser = Number(process.env.ANIMATCH_PRESSURE_VOTES_PER_USER ?? "10");
const animeCount = Number(process.env.ANIMATCH_PRESSURE_ANIME_COUNT ?? "12");
const keepPool = process.env.ANIMATCH_KEEP_PRESSURE_POOL === "1";

if (!inviteCode || !sourcePoolId) {
  console.error("Required env: ANIMATCH_INVITE_CODE, ANIMATCH_SOURCE_POOL_ID");
  process.exit(1);
}

const startedAt = Date.now();
const results = [];
let createdPoolId = null;
let createdSeasonId = null;

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
      throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 240)}`);
    }
    return response;
  } catch (error) {
    const ms = Date.now() - start;
    results.push({ label, status: "ERR", ms });
    throw error;
  }
}

async function api(label, path, { method = "GET", cookie = "", body } = {}) {
  const response = await timed(label, () =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        "user-agent": "AniMatchSeasonWritePressureCheck/1.0"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  );
  const payload = await response.json().catch(() => null);
  if (!payload?.ok) {
    throw new Error(`${label} returned non-ok payload: ${JSON.stringify(payload).slice(0, 240)}`);
  }
  return payload.data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiWithRetry(label, path, options = {}, { attempts = 4, retryDelayMs = 120 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await api(label, path, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("failed with 409") || attempt >= attempts) {
        throw error;
      }
      await sleep(retryDelayMs * attempt);
    }
  }
  throw new Error(`${label} exhausted retry attempts`);
}

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function login(username) {
  const response = await timed(`login:${username}`, () =>
    fetch(`${baseUrl}/api/auth/friend-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, inviteCode })
    })
  );
  const cookie = cookieHeaderFrom(response);
  if (!cookie) throw new Error(`login:${username} did not return auth cookie`);
  return cookie;
}

async function setupDisposableSeason(ownerCookie) {
  const sourcePool = await api("setup:source-pool", `/api/pools/${sourcePoolId}`, { cookie: ownerCookie });
  const animeIds = sourcePool.anime
    .map((entry) => entry.anime?.id)
    .filter((id) => typeof id === "string")
    .slice(0, animeCount);

  if (animeIds.length < 4) {
    throw new Error(`source pool only has ${animeIds.length} usable anime entries`);
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const pool = await api("setup:create-pool", "/api/pools", {
    method: "POST",
    cookie: ownerCookie,
    body: {
      name: `压测临时番组-${stamp}`,
      description: "Codex disposable season write pressure test",
      visibility: "PUBLIC",
      tags: ["pressure-test"]
    }
  });
  createdPoolId = pool.id;

  for (const [index, animeId] of animeIds.entries()) {
    await api(`setup:add-anime:${index + 1}`, `/api/pools/${createdPoolId}/anime`, {
      method: "POST",
      cookie: ownerCookie,
      body: { animeId }
    });
  }

  const season = await api("setup:create-season", `/api/pools/${createdPoolId}/seasons`, {
    method: "POST",
    cookie: ownerCookie,
    body: {
      title: `压测临时赛季-${stamp}`,
      description: "Disposable write pressure test season",
      mode: "BIAS",
      maxVotesPerUser: votesPerUser,
      biasVotesPerUser: 2
    }
  });
  createdSeasonId = season.id;

  await api("setup:start-season", `/api/pools/${createdPoolId}/seasons/${createdSeasonId}/start`, {
    method: "POST",
    cookie: ownerCookie
  });

  return { poolId: createdPoolId, seasonId: createdSeasonId, animeIds };
}

async function runVotingUser(index, poolId, seasonId) {
  const username = `qa-vote-${Date.now().toString(36)}-${index}`;
  const cookie = await login(username);
  let submitted = 0;

  for (let round = 0; round < votesPerUser; round += 1) {
    const queue = await api(`u${index}:queue:${round}`, `/api/pools/${poolId}/seasons/${seasonId}/match-queue?limit=5`, {
      cookie
    });
    const pair = queue[0];
    if (!pair?.left?.animeId || !pair?.right?.animeId) {
      throw new Error(`u${index}: empty queue at round ${round}`);
    }

    const winnerAnimeId = round % 2 === 0 ? pair.left.animeId : pair.right.animeId;
    await apiWithRetry(`u${index}:vote:${round}`, `/api/pools/${poolId}/seasons/${seasonId}/vote`, {
      method: "POST",
      cookie,
      body: {
        leftAnimeId: pair.left.animeId,
        rightAnimeId: pair.right.animeId,
        winnerAnimeId,
        useBiasVote: round < 1,
        clientMutationId: `${username}:${round}:${Date.now()}`
      }
    });
    submitted += 1;
  }

  return submitted;
}

async function cleanup(ownerCookie) {
  if (!createdPoolId || keepPool) return;
  await api("cleanup:delete-pool", `/api/pools/${createdPoolId}`, {
    method: "DELETE",
    cookie: ownerCookie
  });
}

function summarize() {
  const durations = results.map((result) => result.ms).sort((a, b) => a - b);
  const okCount = results.filter((result) => typeof result.status === "number" && result.status >= 200 && result.status < 400).length;

  function percentile(p) {
    if (durations.length === 0) return 0;
    const index = Math.min(durations.length - 1, Math.ceil((p / 100) * durations.length) - 1);
    return durations[index];
  }

  return {
    elapsedMs: nowMs(),
    requestCount: results.length,
    okCount,
    p50Ms: percentile(50),
    p90Ms: percentile(90),
    p95Ms: percentile(95),
    maxMs: durations.at(-1) ?? 0,
    statusCounts: results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] ?? 0) + 1;
      return acc;
    }, {})
  };
}

console.log(
  JSON.stringify({
    event: "write-pressure-start",
    baseUrl,
    sourcePoolId,
    userCount,
    votesPerUser,
    animeCount,
    startedAt: new Date().toISOString()
  })
);

const ownerCookie = await login(`qa-owner-${Date.now().toString(36)}`);

try {
  const setup = await setupDisposableSeason(ownerCookie);
  console.log(JSON.stringify({ event: "write-pressure-setup", poolId: setup.poolId, seasonId: setup.seasonId, animeCount: setup.animeIds.length }));

  const settled = await Promise.allSettled(
    Array.from({ length: userCount }, (_, index) => runVotingUser(index + 1, setup.poolId, setup.seasonId))
  );
  const failures = settled.filter((result) => result.status === "rejected");
  const voteCount = settled.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value : 0), 0);

  const detail = await api("verify:season-detail", `/api/pools/${setup.poolId}/seasons/${setup.seasonId}`, {
    cookie: ownerCookie
  });

  console.log(
    JSON.stringify(
      {
        event: "write-pressure-finish",
        ...summarize(),
        voteCount,
        expectedVotes: userCount * votesPerUser,
        participantCount: detail.participantCount,
        totalVotes: detail.totalVotes,
        failures: failures.map((failure) => String(failure.reason?.message ?? failure.reason)).slice(0, 5)
      },
      null,
      2
    )
  );

  if (failures.length > 0 || voteCount !== userCount * votesPerUser || detail.totalVotes !== userCount * votesPerUser) {
    process.exitCode = 1;
  }
} finally {
  await cleanup(ownerCookie).catch((error) => {
    console.error(`cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
