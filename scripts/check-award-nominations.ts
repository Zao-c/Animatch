/** Integration check: refuses any database except a dedicated disposable award check database. */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { AWARD_TEMPLATE, nomineeKey } from "../src/lib/award-nominations";
import { createCeremony, freezeCeremony, getCeremony, listCeremonies, saveNomination, saveShortlist } from "../src/lib/award-service";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL ?? "").pathname, /^\/animatch_award_check_[a-z0-9_]+$/, "Requires disposable test database");
  const [host, alice, bob, outsider] = await Promise.all(["host", "alice", "bob", "outsider"].map((name) => prisma.user.create({ data: { username: `award_${name}`, name } })));
  const event = await createCeremony(host.id, { title: "年度提名验证", year: 2026, deadline: new Date(Date.now() + 86400000).toISOString(), awardIds: AWARD_TEMPLATE.slice(0, 2).map((a) => a.id) });
  const candidate = { title: "test A", workTitle: "", reason: "a private reason", mediaUrl: "https://example.com" };
  const entries = [{ awardId: AWARD_TEMPLATE[0].id, skipped: false, candidates: [candidate] }];
  assert.deepEqual(await listCeremonies(outsider.id), []);
  await saveNomination(event.id, alice.id, { action: "save", revision: 0, entries });
  let hostView = await getCeremony(event.id, host.id);
  assert.equal(hostView.submittedCount, 0);
  assert.equal(hostView.organizer!.summaries[0].candidates.length, 0, "host cannot count drafts");
  await saveNomination(event.id, alice.id, { action: "submit", revision: 1, entries });
  await saveNomination(event.id, alice.id, { action: "save", revision: 2, entries: [] });
  hostView = await getCeremony(event.id, host.id);
  assert.equal(hostView.organizer!.summaries[0].candidates[0].count, 1, "draft changes do not overwrite submission");
  await assert.rejects(saveNomination(event.id, alice.id, { action: "submit", revision: 2, entries }), { statusCode: 409 });
  const simultaneous = await Promise.allSettled([
    saveNomination(event.id, bob.id, { action: "submit", revision: 0, entries }),
    saveNomination(event.id, bob.id, { action: "submit", revision: 0, entries })
  ]);
  assert.equal(simultaneous.filter((r) => r.status === "fulfilled").length, 1, "concurrent submit cannot duplicate a ballot");
  const visitorView = await getCeremony(event.id, outsider.id);
  assert.equal(visitorView.organizer, null);
  assert.deepEqual(visitorView.published, []);
  assert.equal(visitorView.suggestions[0].candidates[0].title, candidate.title);
  assert.ok(!JSON.stringify(visitorView.suggestions).includes("supporters"));
  assert.ok(!JSON.stringify(visitorView.suggestions).includes("count"));
  assert.ok(!JSON.stringify(visitorView).includes(candidate.reason));
  await assert.rejects(freezeCeremony(event.id, bob.id, { revision: 0 }), { statusCode: 403 });
  await assert.rejects(saveShortlist(event.id, host.id, { revision: 0, publish: true, shortlist: {} }), { statusCode: 409 });
  await freezeCeremony(event.id, host.id, { revision: 0 });
  await assert.rejects(saveNomination(event.id, alice.id, { action: "submit", revision: 3, entries }), { statusCode: 409 });
  await assert.rejects(saveShortlist(event.id, bob.id, { revision: 1, publish: true, shortlist: {} }), { statusCode: 403 });
  await assert.rejects(saveShortlist(event.id, host.id, { revision: 1, publish: true, shortlist: {} }), { statusCode: 400 });
  await saveShortlist(event.id, host.id, { revision: 1, publish: false, shortlist: { [AWARD_TEMPLATE[0].id]: [nomineeKey(candidate)] } });
  assert.deepEqual((await getCeremony(event.id, bob.id)).published, [], "shortlist drafts are private");
  await saveShortlist(event.id, host.id, { revision: 2, publish: true, shortlist: { [AWARD_TEMPLATE[0].id]: [nomineeKey(candidate)] } });
  const published = await getCeremony(event.id, outsider.id);
  assert.deepEqual(published.published[0].candidates, [{ title: candidate.title, workTitle: "" }]);
  assert.ok(!JSON.stringify(published).includes(candidate.reason));
  await assert.rejects(saveShortlist(event.id, host.id, { revision: 3, publish: true, shortlist: {} }), { statusCode: 409 });
  const expired = await createCeremony(host.id, { title: "截止验证", year: 2026, deadline: new Date(Date.now() + 86400000).toISOString(), awardIds: [AWARD_TEMPLATE[0].id] });
  await prisma.awardCeremony.update({ where: { id: expired.id }, data: { deadline: new Date(Date.now() - 1000) } });
  await assert.rejects(saveNomination(expired.id, alice.id, { action: "submit", revision: 0, entries }), { statusCode: 409 });
  assert.equal((await getCeremony(expired.id, alice.id)).canEdit, false);
  const race = await createCeremony(host.id, { title: "冻结并发验证", year: 2026, deadline: new Date(Date.now() + 86400000).toISOString(), awardIds: [AWARD_TEMPLATE[0].id] });
  const raced = await Promise.allSettled([saveNomination(race.id, alice.id, { action: "submit", revision: 0, entries }), freezeCeremony(race.id, host.id, { revision: 0 })]);
  assert.equal(raced[1].status, "fulfilled");
  const raceView = await getCeremony(race.id, host.id);
  assert.equal(raceView.status, "FROZEN");
  assert.equal(raceView.submittedCount, raced[0].status === "fulfilled" ? 1 : 0);
  await assert.rejects(saveNomination(race.id, bob.id, { action: "submit", revision: 0, entries }), { statusCode: 409 });
  const linkedEvent = await createCeremony(host.id, { title: "译名与候选提示验证", year: 2026, deadline: new Date(Date.now() + 86400000).toISOString(), awardIds: [AWARD_TEMPLATE[0].id] });
  const linked = { ...candidate, reference: { kind: "subject", id: 12345 } };
  await saveNomination(linkedEvent.id, alice.id, { action: "submit", revision: 0, entries: [{ ...entries[0], candidates: [linked] }] });
  await saveNomination(linkedEvent.id, bob.id, { action: "submit", revision: 0, entries: [{ ...entries[0], candidates: [{ ...linked, title: "另一译名" }] }] });
  const merged = await getCeremony(linkedEvent.id, host.id);
  assert.equal(merged.organizer!.summaries[0].candidates.length, 1);
  assert.equal(merged.organizer!.summaries[0].candidates[0].count, 2);
  const suggestion = (await getCeremony(linkedEvent.id, outsider.id)).suggestions[0].candidates[0];
  assert.equal(suggestion.key, "bgm:subject:12345");
  assert.equal(Object.keys(suggestion).sort().join(","), "key,reference,title,workTitle");
  console.log(JSON.stringify({ ok: true, checks: ["draft privacy", "submission snapshot", "optimistic conflict", "concurrent submit", "ownership", "freeze", "deadline", "shortlist secrecy", "published projection", "no winner inferred"] }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
