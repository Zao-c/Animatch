/** Runs only against a disposable database; creates synthetic rows without remote requests. */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { addQuickImportToPool } from "../src/lib/import/quick-pool-builder";
async function main() {
  assert.match(new URL(process.env.DATABASE_URL ?? "").pathname, /^\/animatch_award_check_[a-z0-9_]+$/);
  const user = await prisma.user.create({ data: { username: "batch_check" } });
  const pool = await prisma.customPool.create({ data: { name: "batch check", creatorId: user.id } });
  const ids = Array.from({ length: 500 }, (_, i) => `batch_check_${i}`);
  await prisma.anime.createMany({ data: ids.map((id) => ({ id, title: id, source: "MANUAL" })) });
  const first = await addQuickImportToPool(pool.id, ids, user.id);
  assert.equal(first.addedCount, 500);
  assert.equal(first.failedCount, 0);
  const retry = await addQuickImportToPool(pool.id, [...ids, ids[0], "missing"], user.id);
  assert.equal(retry.addedCount, 0);
  assert.equal(retry.skippedCount, 501);
  assert.equal(retry.failedCount, 1);
  const entries = await prisma.poolAnime.findMany({ where: { poolId: pool.id }, orderBy: { position: "asc" } });
  assert.equal(entries.length, 500);
  assert.equal(new Set(entries.map((e) => e.position)).size, 500);
  assert.deepEqual(entries.map((e) => e.animeId), ids);
  console.log(JSON.stringify({ ok: true, checks: ["500-item batch", "stable order", "duplicate retry", "missing item count"] }));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
