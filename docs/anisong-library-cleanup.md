# AniSongMatch PR 4: quiet song library and clear primary action

Stacked on PR #4 (`codex/anisongmatch-tier-editor`).

## Flow
- Music hub: public templates / my boards / create a personal board. Publishing is not implied by creation.
- Song board: primary Start/Continue Match and Tier List actions first.
- Add songs: one closed-by-default entry that offers manual upload, iTunes, Netease or batch import. Only the chosen source UI is mounted; its existing API calls, QR login, playback sourcing and retry logic remain untouched.
- Candidates: search/filter, select participating songs, manage status and continue Match.
- Settings & public publishing: folded secondary area, with rename, existing public-publish consent, and delete confirmation.

## Compatibility
- No new routes, schema or migration.
- Existing board and song IDs, audio data, vote ledger, ranking, sharing and exports stay intact.
- Existing iTunes fallback association on a song card remains reachable.
- Opening a different import method prompts before abandoning local editing and queued files.
- Source-search components gain only an optional initialOpen prop; old uses default to collapsed.
- Keep PR 2 -> PR 3 -> PR 4 -> this PR stacked until each is validated.

## Manual release checklist
- Create board, add songs each way, upload audio and cover, batch import a few files, pause/retry, edit and delete a song.
- Match a song to iTunes as fallback; search/login with Netease.
- Set candidate scope, start Match, vote, undo, reload and view Tier editor.
- Publish only when authorized, close settings, rename, and confirm destructive delete.
- Check unsaved draft warnings on source switching and navigation.
- Check 320px / 390px / desktop layouts and keyboard focus; use screenshots alongside the ordinary Anime Match pool.
- Run pnpm test, pnpm lint, pnpm exec tsc --noEmit, pnpm build. Tests have not been executed in this environment.
