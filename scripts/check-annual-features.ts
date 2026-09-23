/** Run only against a disposable database whose name includes _annual_check_. */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { saveCollection, getCollection, createAnnualFinal } from "../src/lib/collection-service";
import { getTasteProfile, findTasteMatches } from "../src/lib/taste-service";
import { endSeason } from "../src/lib/season-service";

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? "").pathname;
  assert.match(database, /^\/animatch_annual_check_[a-z0-9_]+$/, "Refusing to write to a non-test database");
  const users = await Promise.all(["owner", "similar", "opposite", "private"].map((name) => prisma.user.create({
    data: { username: `annual_test_${name}`, name, tasteProfilePublic: name !== "private", allowTasteMatching: name !== "private" }
  })));
  const pool = await prisma.customPool.create({ data: { creatorId: users[0].id, name: "年度验证", visibility: "PUBLIC", status: "PUBLISHED", tags: [] } });
  const animes = await Promise.all(Array.from({ length: 12 }, (_, i) => prisma.anime.create({ data: { title: `验证作品${i}`, tags: [i % 2 ? "恋爱" : "悬疑"], source: "MANUAL", sourceId: `annual-test-${i}` } })));
  await prisma.poolAnime.createMany({ data: animes.map((anime, position) => ({ poolId: pool.id, animeId: anime.id, position })) });
  const seasons = await Promise.all(["开播", "完结"].map((title) => prisma.battleSeason.create({ data: { title, poolId: pool.id, createdByUserId: users[0].id, status: "ACTIVE", startsAt: new Date("2026-01-01") } })));
  for (const season of seasons) for (const [userIndex, user] of users.entries()) {
    await prisma.battleSeasonUserScore.createMany({ data: animes.map((anime, i) => ({
      seasonId: season.id, poolId: pool.id, userId: user.id, animeId: anime.id,
      eloScore: 1600 + (userIndex === 2 ? i : 12 - i) * 10, compareCount: 5, winCount: 3, lossCount: 2, lastVotedAt: new Date()
    })) });
  }
  assert.equal((await getTasteProfile(users[3].username!, users[0].id)).visible, false);
  assert.equal((await getTasteProfile(users[0].username!, users[0].id)).profile?.animeCount, 12);
  const matches = await findTasteMatches(users[0].id, `season:${seasons[0].id}`);
  assert.equal(matches.closest[0].username, users[1].username);
  assert.equal(matches.closest[0].similarity, 100);
  assert.equal(matches.furthest[0].username, users[2].username);
  assert.equal(matches.furthest[0].similarity, 0);
  assert.equal(matches.candidateCount, 2);
  await endSeason(pool.id, seasons[0].id, users[0].id);
  const collection = await saveCollection(users[0].id, { title: "年度整合验证", year: 2026, sources: seasons.map((season, index) => ({ seasonId: season.id, quarter: 1, phase: index === 0 ? "OPENING" : "ENDING" })) });
  const original = await getCollection(users[0].id, collection.id);
  assert.equal(original.animeCount, 12);
  assert.equal(original.comparisons[0].personal.length, 12);
  assert.ok(original.sources.find((source) => source.phase === "OPENING")?.capturedAt);
  // Changing underlying rows after capture cannot rewrite the historical result.
  await prisma.battleSeasonUserScore.updateMany({ where: { seasonId: seasons[0].id, userId: users[0].id }, data: { eloScore: 42 } });
  const frozen = await getCollection(users[0].id, collection.id);
  assert.deepEqual(frozen.sources.find((source) => source.phase === "OPENING")?.personal, original.sources.find((source) => source.phase === "OPENING")?.personal);
  await assert.rejects(getCollection(users[1].id, collection.id), { statusCode: 404 });
  const finals = await Promise.all([createAnnualFinal(users[0].id, collection.id), createAnnualFinal(users[0].id, collection.id)]);
  assert.equal(finals[0].poolId, finals[1].poolId);
  const final = await prisma.customPool.findUniqueOrThrow({ where: { id: finals[0].poolId }, include: { poolAnime: true } });
  assert.equal(final.visibility, "PRIVATE");
  assert.equal(final.poolAnime.length, 12);
  assert.ok(final.poolAnime.every((entry) => entry.initialElo === 1500));
  await assert.rejects(saveCollection(users[0].id, { title: "禁止改来源", year: 2026, sources: [{ seasonId: seasons[0].id, quarter: 1, phase: "OPENING" }] }, collection.id), { statusCode: 409 });
  await prisma.user.update({ where: { id: users[1].id }, data: { allowTasteMatching: false } });
  assert.equal((await findTasteMatches(users[0].id, `season:${seasons[0].id}`)).closest.length, 0);
  console.log(JSON.stringify({ ok: true, checks: ["default privacy", "taste profile", "opposite and similar", "source comparison", "frozen results", "ownership", "concurrent final idempotency", "deduplication", "fresh Elo", "consent withdrawal"] }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
