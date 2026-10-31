# AniSongMatch PR 1 — Independent routes

This change is based on feature/anisongmatch, not main.

- \`/anisong/[boardId]\`: song library and candidate selection
- \`/anisong/[boardId]/match\`: music duels
- \`/anisong/[boardId]/tier\`: music Tier List
- Old \`?view=match\` and \`?view=tier\` URLs redirect to the new routes.

The existing SongBoard schema, revision guards, vote events, Elo algorithm,
audio playback providers and share snapshots are unchanged. The match and Tier
sections are isolated in SongMatchPanel and SongTierPanel. This is the first
incremental routing/UI PR; drag-and-drop Tier editing and higher-quality album
art belong to follow-up PRs.

Manual verification:
1. Open an existing board and start/continue a duel, vote, undo and reload.
2. Check both legacy links and new routes.
3. Confirm that Tier PNG and JSON export and published share links still work.
4. Check music playback on mobile and desktop.
5. Check revision conflict handling and navigating away from unfinished edits.
