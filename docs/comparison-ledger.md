# Comparison Ledger

`PoolComparison` is the append-only ledger for a single personal ranking
decision. It should be useful even when the score table has moved on, so each row
stores the pair, the submitted result, and the ranking context at submit time.

## Why Store Left / Right / Result

Winner and loser are not enough to reconstruct what happened:

- `DRAW`, `SKIP`, and unseen results do not have a winner or loser.
- Frontend bugs are easier to debug when the stored row preserves the exact
  `leftAnimeId`, `rightAnimeId`, and `result` submitted by the client.
- A history view needs to show the original left/right card order, not only the
  outcome.

The canonical decision fields are:

- `leftAnimeId`
- `rightAnimeId`
- `result`
- `winnerAnimeId`
- `loserAnimeId`

`winnerAnimeId` and `loserAnimeId` are derived convenience fields for decisive
results. They must stay nullable for non-decisive and non-effective results.

## Result Rules

- `LEFT_WIN`: `winnerAnimeId = leftAnimeId`, `loserAnimeId = rightAnimeId`.
- `RIGHT_WIN`: `winnerAnimeId = rightAnimeId`, `loserAnimeId = leftAnimeId`.
- `DRAW`: no winner or loser. Elo can still move according to the existing Elo
  draw formula, so before/after values are recorded.
- `SKIP`: no winner or loser. Elo before and after are recorded as unchanged.
- `LEFT_UNSEEN`, `RIGHT_UNSEEN`, `BOTH_UNSEEN`: no winner or loser. Elo before
  and after are recorded as unchanged.

`LEFT_WIN`, `RIGHT_WIN`, and `DRAW` are effective comparisons. `SKIP` and unseen
results are not effective comparisons and do not count toward ranking progress.

## Elo Context

Each row stores:

- `leftEloBefore`, `leftEloAfter`
- `rightEloBefore`, `rightEloAfter`
- `deltaLeft`, `deltaRight`
- `expectedLeft`, `expectedRight`
- `leftKFactor`, `rightKFactor`

These fields make score movement auditable without replaying historical rows.
They also make it possible to build an Elo change curve for a single anime.

The Elo formula itself remains `elo-v1`; this ledger change records the formula's
inputs and outputs, but does not change the update logic.

## Position Context

`leftPosition` and `rightPosition` store the 1-based rank position before the
comparison was applied, sorted by current run Elo descending. Position snapshots
answer questions like "which boundary did this match affect?" and "how did this
anime climb from rank 20 to rank 8?"

## AniScore Snapshots

`leftScore10Before`, `leftScore10After`, `rightScore10Before`, and
`rightScore10After` store display-only AniScore values computed from the run's
score distribution. They are for history and UI explanations only; they are not
used for sorting or Elo updates.

## Mode

`mode` identifies where the decision came from:

- `NORMAL`: ordinary Match flow.
- `RECALIBRATE`, `FOCUS_RECALIBRATE`, `RANGE_RECALIBRATE`: recalibration flows
  that submit through the same comparison service.

Manual tier locks are not ledger rows by themselves; they are tracked separately
as manual adjustments and can be correlated with comparisons later.

## History API

`GET /api/pools/[poolId]/runs/[runId]/comparisons?limit=20` returns recent ledger
rows in descending `createdAt` order. The limit defaults to 20 and caps at 100.

Archived pools are readable through this API because history is a read-only
operation. The API still validates that the pool exists, the run exists, and the
run belongs to the pool and current user.

## Future Uses

The strengthened ledger supports:

- recent comparison history;
- per-anime "how it moved up" timelines;
- Elo and AniScore change charts;
- user taste drift analysis;
- community season consistency and agreement metrics;
- debugging mismatched frontend `result`, `winner`, or `loser` payloads.
