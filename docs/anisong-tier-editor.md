# AniSongMatch PR 3: editable and persistent music Tier List

Stacked on PR #3 (code branch codex/anisongmatch-duel-ui-cover).

- Existing v1 SongBoard JSON remains readable; optional manualOrder stores S/A/B/C/D in-row ordering.
- SongTierEditor matches the original Tier workflow: enter edit mode, drag across rows/within rows, mobile controls, undo a draft movement, save or cancel, reset automatic tiers.
- Only Save calls the revisioned SongBoard PATCH API. A stale revision is rejected with 409.
- A complete saved layout locks visible placements to prevent percentile re-bucketing from shifting untouched songs.
- Current candidate set is saved; excluded and hidden songs keep their preferences.
- Published share snapshots and PNG use songSnapshot and therefore reflect the saved layout, not draft edits. Existing shares remain frozen until republished.
- No Prisma migration or Elo/pairing modifications.

## Before merging

Run pnpm test, pnpm lint, pnpm exec tsc --noEmit, pnpm build.
Verify desktop drag/drop, touch select/up/down, undo, cancel, save, refresh, conflicting tabs, reset auto, 64 tracks, existing legacy boards and both exports in the browser.
Do not merge until actual browser verification succeeds.
