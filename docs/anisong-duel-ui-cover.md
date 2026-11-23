# AniSongMatch PR 2 — Shared duel cards and artwork quality

Stacked on PR 1 (branch codex/anisongmatch-route-split).

## Changes
- Anime and music duel cards now share a vote card shell: image vote target, title, vote CTA, borders and focus handling.
- Song audio player remains independent of the cover vote target. Existing playback, fallback and keyboard logic are untouched.
- Music match uses the same generous page width as personal AniMatch rather than the former narrow 4xl wrapper.
- iTunes cover requests prefer known 600x600 Apple CDN variants; old 100px artwork has a fallback.
- Small source images are centered without extreme scaling. In hero mode their actual dimensions bound the displayed area.
- New snapshots and iTunes search results use preferred artwork URLs. Existing stored tracks need no migration.

## Verification required before merge
- Run unit tests, TypeScript, lint and production build.
- In desktop and 320/390px mobile browsers compare normal / music cards, clicking cover vs play, both keyboard paths, active/loading states and source fallback.
- Verify old music cards with 100px artwork and manual uploaded artwork.
- Verify the song Tier List / PNG still works and does not change votes.
- Confirm the upstream Apple artwork path accepts the 600px variant for real records; fallbacks remain in place.

This PR intentionally does not implement Tier drag/drop (PR 3) or rework playback licensing.
