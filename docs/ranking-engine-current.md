# Ranking Engine Current State

This document audits the current personal ranking engine before Ranking Engine v2 work. It is based on the current source code and intentionally does not propose schema changes.

## 1. Current next-pair entry files

- Normal Match queue API: `src/app/api/pools/[poolId]/runs/[runId]/match-queue/route.ts`
- Normal Match service: `src/lib/match-service.ts`
- Pair picker: `src/lib/pairing.ts`
- Comparison submit API: `src/app/api/pools/[poolId]/runs/[runId]/comparisons/route.ts`
- Result semantics: `src/lib/match-rules.ts`
- Elo update: `src/lib/elo.ts`
- Recalibration session API: `src/app/api/pools/[poolId]/runs/[runId]/recalibration/route.ts`
- Recalibration next-pair API: `src/app/api/pools/[poolId]/runs/[runId]/recalibration/[sessionId]/next-pair/route.ts`
- Recalibration service/rules: `src/lib/recalibration-service.ts`, `src/lib/recalibration-rules.ts`
- Tier read API: `src/app/api/pools/[poolId]/runs/[runId]/tierlist/route.ts`

## 2. Current pair selection flow

Normal Match uses `GET /api/pools/:poolId/runs/:runId/match-queue`.

1. The route parses `limit`, defaults to 8, and clamps it to 1-10.
2. `getMatchQueue` calls `assertRunAccess`, so the run must exist, belong to the current user, belong to the pool, and be `ACTIVE`.
3. `initializeScoresForRun` creates missing `UserPoolScore` rows from `PoolAnime.initialElo`.
4. The service reads all scores for this user/pool/run and all pool anime display overrides.
5. Hidden scores are removed from pairing with `visibleScores = scores.filter(score => !score.isHidden)`.
6. The service reads recent comparisons, taking the latest 50, and all comparison pair keys for the run.
7. It repeatedly calls `pickNextPair` until the requested queue is full or no candidate remains.
8. Newly queued pairs are tracked in `queuedPairKeys`, so the API response does not include duplicate pairs in the same queue.

`pickNextPair` scores every pair candidate. It rejects same-item pairs, hidden items, and recent pairs. It does not reject older repeated pairs, but older repeated pairs lose the new-pair bonus.

The priority formula currently rewards:

- close Elo: `max(0, 400 - eloDiff)`
- uncertainty: `avgUncertainty * 0.4`
- low compare count: `max(0, 80 - avgCompareCount * 4)`
- never directly compared before: `+120`
- same manual tier: `+60`
- adjacent manual rank: up to `+40`

The picker sorts by priority and deterministic pair key, takes the top 20, then randomly selects one of those top candidates.

## 3. Current score read logic

Normal Match reads `UserPoolScore` rows by `userId`, `poolId`, and `runId`, including the related `Anime`. Missing scores are initialized from the pool items first.

Tier reads use `getRunTierList`:

1. `assertRunAccess` validates the run.
2. Scores are read for the current user/pool/run.
3. `poolComparison.count` is used for total comparisons.
4. `poolAnime.findMany` supplies display overrides.
5. `toTierListItem` combines public anime fields, score fields, and effective display fields.
6. `buildTierList` sorts automatic entries by Elo and places them into S/A/B/C/D percentile buckets.
7. Manual locked items are placed in their locked tier and sorted by manual rank, then Elo.

Manual locked items are not excluded from normal Match pairing. Their manual tier/rank are passed into `ScoreItem`, which can add same-tier and adjacent-rank priority bonuses.

## 4. Current comparison write logic

Comparison writes use `POST /api/pools/:poolId/runs/:runId/comparisons`.

1. The route validates `result` against `PoolComparisonResult` and optional `mode` against `PoolComparisonMode`.
2. `submitComparison` validates input and calls `assertRunAccess`.
3. The transaction first checks `userId + clientMutationId` for idempotency.
4. Recalibration modes require an active recalibration session.
5. Both anime must exist in the pool via `poolAnime.findUnique`.
6. Scores are upserted before writing the comparison.
7. The comparison row stores the result, mode, pair key, effective flag, seen state, before/after Elo for effective results, algorithm version, pairing version, tier rule version, and mutation id.
8. Effective results update Elo and score counters.
9. Non-effective results update skip/unseen counters only.
10. Recalibration mode increments the active session completed count and completes the session when planned count is reached.

## 5. DRAW / SKIP / UNSEEN effects

`isEffectiveResult` returns true only for:

- `LEFT_WIN`
- `RIGHT_WIN`
- `DRAW`

These three write `PoolComparison.isEffective = true`, update Elo, increment `compareCount`, update win/loss/draw counters, reduce uncertainty, and set `lastComparedAt`.

`DRAW` has no winner or loser. Elo uses a 0.5/0.5 result.

`SKIP` is not effective. It writes a comparison history row, does not update Elo, does not increment `compareCount`, and increments `skipCount` on both scores.

`LEFT_UNSEEN`, `RIGHT_UNSEEN`, and `BOTH_UNSEEN` are not effective. They write a comparison history row, do not update Elo, and mark the unseen anime in `UserAnimeStatus`. A score is hidden from future normal Match pairing after two unseen marks via `shouldHideAfterUnseen`.

## 6. Current strengths

- The system has clean separation between result semantics, Elo update, pair priority, Match service, and Recalibration rules.
- Pairing avoids exact duplicate pairs inside one queue response and excludes the latest 50 recent pair keys.
- New pairs are prioritized with a clear bonus.
- Elo-close pairs are favored, which helps refine boundaries.
- Uncertainty and low compare count both increase priority, so early exploration has a path.
- `clientMutationId` makes comparison submission idempotent.
- `isEffective` gives a stable way to count real ranking signal separately from skip/unseen history.
- Recalibration uses a separate queue builder with SMART/RANGE/FOCUS modes instead of overloading normal Match.

## 7. Current issues

- Normal Match can still repeat older pair keys after they leave the recent window. It receives no new-pair bonus, but it is still eligible.
- The top-20 random pick makes behavior less predictable and makes before/after debugging harder.
- Pairing does not explicitly reserve exploration slots for never-compared or very low compare-count items; it relies on the priority formula.
- Manual locked items can still be paired in normal Match. They are not mutated by manual tier ordering, but their Elo can still change through Match results.
- Archived pool behavior is governed by `assertRunAccess` and route-level pool policies. Normal Match still requires an active run and is not a dedicated read-only flow.
- Recalibration and normal Match use similar but separate priority formulas; future behavior changes need to be duplicated or intentionally kept separate.
- Pairing does not currently explain user-facing reasons from normal Match beyond an internal `reason` string.
- Effective progress was previously not exposed as first-class UI state; users saw confidence but not how many meaningful comparisons were needed.

## 8. Next-pair v2 recommendations

- Keep Elo update and comparison result semantics unchanged.
- Introduce a deterministic candidate scoring breakdown for debugging: Elo closeness, novelty, low data, uncertainty, tier boundary, and manual lock penalties.
- Add explicit quotas or staged modes: early exploration for low compare-count items, then boundary refinement for Elo-close items.
- Treat manual locked items as lower priority or opt them out from normal Match unless the user starts Recalibration.
- Use `isEffective` counts for progress and stage decisions everywhere.
- Keep recent-pair blocking, but consider a stronger repeat cooldown based on pair age and total pool size.
- Return a user-facing reason for each normal Match pair that does not expose internal numeric noise.
- Version the next-pair policy string separately from `algorithmVersion`, for example `pairingVersion = "active-v2"`, when v2 is implemented.
