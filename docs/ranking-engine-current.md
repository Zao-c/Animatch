# Ranking Engine Current State

This document audits the current personal ranking engine before Ranking Engine v2 work. It is based on the current source code and intentionally does not propose schema changes.

## 1. Current next-pair entry files

- Normal Match queue API: `src/app/api/pools/[poolId]/runs/[runId]/match-queue/route.ts`
- Normal Match service: `src/lib/match-service.ts`
- Pair picker compatibility export: `src/lib/pairing.ts`
- Pair picker v2 implementation: `src/lib/ranking-pairing.ts`
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
7. It builds ranking progress, then repeatedly calls `pickNextPair` with the current stage until the requested queue is full or no candidate remains.
8. Newly queued pairs are tracked in `queuedPairKeys`, so the API response does not include duplicate pairs in the same queue.

`pickNextPair` scores every pair candidate. It rejects same-item pairs and hidden items. It strongly avoids recent pairs by selecting from non-recent candidates first. If all candidates are recent, it falls back to recent candidates with a large penalty so Match does not get stuck while legal pairs still exist.

The v2 priority formula records explicit reasons and rewards or penalizes:

- cold start coverage for items with `compareCount < 2`
- low exposure relative to the stage target
- Elo closeness
- tier-boundary proximity based on rank percentile
- new pairs
- recent repeat penalty
- manual lock penalty
- neighboring rank proximity
- small random jitter

The picker sorts by total score and deterministic pair key. Randomness is a small jitter in the score, not a top-20 random post-selection.

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
- Pairing avoids exact duplicate pairs inside one queue response and strongly avoids the latest 50 recent pair keys.
- New pairs, cold-start items, low-exposure items, Elo-close pairs, and boundary pairs are prioritized with explicit debug reasons.
- Stage-aware weights favor broad coverage early and boundary refinement later.
- `clientMutationId` makes comparison submission idempotent.
- `isEffective` gives a stable way to count real ranking signal separately from skip/unseen history.
- Recalibration uses a separate queue builder with SMART/RANGE/FOCUS modes instead of overloading normal Match.

## 7. Current issues

- Normal Match can still repeat older pair keys after they leave the recent window. It receives no new-pair bonus, but it is still eligible.
- v2 does not mathematically optimize total information gain; it is a product heuristic with explicit scoring reasons.
- Manual locked items can still be paired in normal Match, but v2 now lowers their priority. They are not mutated by manual tier ordering, but their Elo can still change through Match results.
- Archived pool behavior is governed by `assertRunAccess` and route-level pool policies. Normal Match still requires an active run and is not a dedicated read-only flow.
- Recalibration and normal Match use similar but separate priority formulas; future behavior changes need to be duplicated or intentionally kept separate.
- Pairing explains internal reasons through `selectedPairDebug`, but the UI still intentionally avoids exposing detailed debug scoring.
- Effective progress was previously not exposed as first-class UI state; users saw confidence but not how many meaningful comparisons were needed.

## 8. Next-pair v2 recommendations

- Keep Elo update and comparison result semantics unchanged.
- Consider adding real slot quotas on top of v2 scoring if cold-start coverage still feels too slow in large pools.
- Consider exposing a short user-facing reason separate from the internal `selectedPairDebug`.
- Use `isEffective` counts for progress and stage decisions everywhere.
- Keep recent-pair blocking, but consider a stronger repeat cooldown based on pair age and total pool size.
- Return a user-facing reason for each normal Match pair that does not expose internal numeric noise.
- Version the next-pair policy string separately from `algorithmVersion`, for example `pairingVersion = "active-v2"`, when v2 is implemented.
