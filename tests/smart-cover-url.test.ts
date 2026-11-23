import { describe, expect, it } from "vitest";
import { needsSmartCover, smartCoverUrl } from "../src/lib/smart-cover-url";

describe("smart cover URLs", () => {
  it("uses separate cached versions for 2:3 cards and square tier lists", () => {
    const src = "/uploads/custom-items/character.png";
    expect(smartCoverUrl(src, "CUSTOM_UPLOAD", "card"))
      .toBe("/api/cover-thumbnail?variant=card&src=%2Fuploads%2Fcustom-items%2Fcharacter.png");
    expect(smartCoverUrl(src, "CUSTOM_UPLOAD", "tier"))
      .toBe("/api/cover-thumbnail?variant=tier&src=%2Fuploads%2Fcustom-items%2Fcharacter.png");
    expect(smartCoverUrl(src, "CUSTOM_UPLOAD", "match"))
      .toBe("/api/cover-thumbnail?variant=match&src=%2Fuploads%2Fcustom-items%2Fcharacter.png");
  });

  it("supports edited existing pool covers even for non-custom sources", () => {
    expect(needsSmartCover("MANAMI", "/uploads/anime-covers/updated.webp")).toBe(true);
    expect(smartCoverUrl("/uploads/anime-covers/updated.webp", "MANAMI", "tier"))
      .toContain("variant=tier");
  });

  it("recognises legacy snapshots that only stored an upload path", () => {
    // Snapshots created before `source` was persisted must still get the new layout.
    expect(needsSmartCover(undefined, "/uploads/custom-items/character.png")).toBe(true);
    expect(smartCoverUrl("/uploads/custom-items/character.png", undefined, "card"))
      .toContain("variant=card");
  });

  it("does not alter normal poster URLs or unsafe local paths", () => {
    const src = "https://lain.bgm.tv/pic/cover/l/frieren.jpg";
    expect(smartCoverUrl(src, "BANGUMI", "tier")).toBe(src);
    expect(smartCoverUrl("/uploads/custom-items/../secret.png", "CUSTOM_UPLOAD", "card"))
      .toBe("/uploads/custom-items/../secret.png");
    expect(smartCoverUrl(null, "CUSTOM_UPLOAD", "card")).toBeNull();
  });

  it("includes the source URL so replacing an uploaded cover creates a new key", () => {
    const oldUrl = smartCoverUrl("/uploads/anime-covers/old.webp", "MANAMI", "tier");
    const newUrl = smartCoverUrl("/uploads/anime-covers/new.webp", "MANAMI", "tier");
    expect(oldUrl).not.toBe(newUrl);
  });
});
