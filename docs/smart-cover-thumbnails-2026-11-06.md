# Automatic artwork thumbnails for AniMatch (2026-11-06)

## Problem

Imported character illustrations are often 2048×1024 RGBA splash artwork, while
regular cards are 2:3 and Tier List exports are square. `contain` made characters
tiny and left large black gaps, and previous per-pool uploads could be removed
even when an immutable shared Tier snapshot still referenced their URLs.

## Implementation

- Preserve the original artwork and persistent pool-specific `coverUrlOverride`.
- Generate two derivatives on demand:
  - `variant=card`: 320×480 WebP for 2:3 artwork cards and the manual Tier board.
  - `variant=tier`: 256×256 WebP for Tier grids, public shares, and PNG exports.
- For user-uploaded/TierMaker artwork and uploaded override URLs, sample alpha,
  suppress isolated transparent edges, trim visible bounds, choose a crop near
  the alpha-weighted visual center, then composite it over a blurred background.
- The browser first tries the derivative. If it fails, it retries the original
  image (or the original's known fallback sources). Normal anime posters keep
  their existing loading/display logic.
- Remote assets are loaded **only** through the existing image-proxy route,
  preserving the host allowlist, IP validation and upstream cache. Local assets
  are read only from the validated `uploads/anime-covers` or
  `uploads/custom-items` directories.
- Generated files are cached for seven days under
  `/app/data/image-cache/smart-covers/` in production, using the existing
  persistent image-cache Docker volume. Set
  `ANIMATCH_SMART_COVER_CACHE_DIR` to override this directory.
- Derivative keys include algorithm version, variant and full original URL.
  Replacing an uploaded cover (which already generates a unique filename)
  immediately selects a different derivative URL.
- Previously uploaded covers are retained when a pool override is changed or
  cleared, because historical public Tier share snapshots are immutable and
  may still reference them. A future reference-aware garbage collector may
  remove unreferenced originals.

## Compatibility and limits

Existing pools and previously uploaded images are handled lazily when visited;
**no database migration, re-import or destructive bulk rewrite** is required.
Share snapshots remain immutable. Create a new share if the public URL should
show an updated cover; local Tier List pages use current pool overrides.

The alpha centroid is deliberately lightweight and not a face-detector. For
complex multi-character art or text burned into the middle of an illustration,
automatic cropping may still be imperfect. The existing manual cover override
can be used for exceptional entries. Avoid automatic AI inpainting or OCR
removal; those could alter the art unexpectedly.

## Verification

```bash
pnpm test -- tests/smart-cover-thumbnail.test.ts tests/smart-cover-url.test.ts tests/cover-thumbnail-route.test.ts
pnpm test
pnpm run build
```

Include manual QA for (1) a wide transparent character illustration, (2) a
square/portrait JPG, (3) an existing TierMaker import, (4) replacing a cover
on an existing pool, (5) a new share versus an old immutable share and (6)
PNG export after an API thumbnail failure. No automated test can ensure ideal
cropping for every illustration.
