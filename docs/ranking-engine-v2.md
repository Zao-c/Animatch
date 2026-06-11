# Ranking Engine v2: next-pair strategy

Ranking Engine v2 changes only ordinary Match pair selection. It keeps the existing database schema, Elo update formula, comparison submit API, result types, TierShare, export image flow, and custom upload flow unchanged.

## 1. Goal

The goal is to reach a useful personal Tier List with fewer matches. Sprint 1 made progress visible; Sprint 2 uses that progress stage to choose better next pairs.

The new picker is implemented in `src/lib/ranking-pairing.ts`. `src/lib/pairing.ts` remains a compatibility export so existing imports do not need to move.

## 2. Stage weights

The picker receives `RankingProgress.stage` from `getMatchQueue`.

- `DRAFTING`: high weight on `cold_start` and `low_exposure`, medium `elo_close`, small `tier_boundary`. This pushes each item toward basic exposure before over-refining boundaries.
- `DRAFT_READY`: higher `elo_close` and `tier_boundary`, medium `low_exposure`. The list has a usable draft, so close calls matter more.
- `RELIABLE`: similar to draft-ready but slightly stronger boundary and rank-neighbor scoring.
- `HIGH_CONFIDENCE`: strongest `tier_boundary` and `same_or_neighbor_rank`, smaller `low_exposure`, larger recent-repeat and manual-lock penalties.
- `EMPTY`: treated like an early-stage fallback; normal Match still returns no pair if fewer than two visible items exist.

## 3. Scoring reasons

Every scored candidate keeps a reason list:

- `cold_start`: one or both items have `compareCount < 2`. One cold item paired with a stable, median-ish item scores higher than cold-vs-cold.
- `low_exposure`: items below the stage target exposure receive a boost.
- `elo_close`: smaller Elo differences score higher.
- `tier_boundary`: rank percentiles near 10%, 30%, 60%, or 85% receive a boost. Pairs near the same boundary get an extra boost.
- `new_pair`: pairs not seen in the run ledger receive a boost.
- `recent_repeat_penalty`: pairs from the latest 50 comparisons receive a large penalty.
- `manual_lock_penalty`: manual locked items are de-prioritized.
- `same_or_neighbor_rank`: close current rank positions receive a boost.
- `random_jitter`: a small score perturbation avoids repeatedly selecting the same candidate shape.

The selected pair keeps `selectedPairDebug` with `total` and `reasons`. The UI does not expose this debug detail.

## 4. Fallback rules

The picker uses this order:

1. Select the highest-scoring non-recent candidate.
2. If no non-recent candidate exists, allow recent candidates with `recent_repeat_penalty`.
3. If scoring somehow produces no candidate but two visible items exist, return the first two visible different items.
4. If fewer than two visible items exist, return `null`.

Pair keys use the existing unordered `makePairKey`, so `A:B` and `B:A` are the same pair.

## 5. SKIP / UNSEEN

`SKIP`, `LEFT_UNSEEN`, `RIGHT_UNSEEN`, and `BOTH_UNSEEN` are not effective comparisons. They still write comparison history, but they do not update Elo and do not count toward ranking progress.

The next-pair picker reads comparison history and score state only. It does not change submit behavior.

## 6. Manual locked items

Manual locked items are penalized, not excluded. Excluding them completely would make it impossible for future normal Match activity to correct stale manual placements. Penalizing them avoids spending too many matches on items the user already confirmed.

## 7. Limits

This is still a product heuristic, not a mathematically optimal active-learning algorithm. It should feel better because it explicitly balances coverage, close comparisons, boundary refinement, novelty, and repeat avoidance. Future work can add hard quotas or a richer uncertainty model without changing the Elo ledger.
