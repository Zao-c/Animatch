import { describe, expect, it } from "vitest";
import { PoolStatus, Visibility } from "@prisma/client";
import { canAddAnime, canEditPoolContent, canManagePool } from "../src/lib/pool-permissions";
import type { FriendAuthUser } from "../src/lib/auth-session";

function makeUser(id: string): FriendAuthUser {
  return { id, username: id, name: id, image: null };
}

function makePool(overrides: Record<string, unknown> = {}) {
  return {
    id: "pool-1",
    creatorId: "owner-1",
    visibility: Visibility.PUBLIC as Visibility,
    status: PoolStatus.DRAFT as PoolStatus,
    deletedAt: null as Date | null,
    isOfficialDemo: false,
    allowPublicEdit: false,
    allowCommunityMatch: false,
    ...overrides
  };
}

describe("pool permissions", () => {
  describe("canManagePool", () => {
    it("returns true for the pool owner", () => {
      expect(canManagePool(makePool({ creatorId: "owner-1" }), makeUser("owner-1"))).toBe(true);
    });

    it("returns false for non-owner", () => {
      expect(canManagePool(makePool(), makeUser("other-user"))).toBe(false);
    });

    it("returns false for anonymous", () => {
      expect(canManagePool(makePool(), null)).toBe(false);
    });
  });

  describe("canAddAnime / canEditPoolContent", () => {
    it("owner can always add/edit in their own pool", () => {
      expect(canAddAnime(makePool(), makeUser("owner-1"))).toBe(true);
      expect(canEditPoolContent(makePool(), makeUser("owner-1"))).toBe(true);
    });

    it("anonymous cannot add/edit", () => {
      expect(canAddAnime(makePool(), null)).toBe(false);
    });

    it("official demo allows logged-in non-owner to add/edit", () => {
      expect(
        canAddAnime(
          makePool({ isOfficialDemo: true, creatorId: "owner-1" }),
          makeUser("other-user")
        )
      ).toBe(true);
    });

    it("official demo denies anonymous editing", () => {
      expect(
        canAddAnime(makePool({ isOfficialDemo: true }), null)
      ).toBe(false);
    });

    it("private pool denies non-owner editing", () => {
      expect(
        canAddAnime(
          makePool({ visibility: Visibility.PRIVATE, creatorId: "owner-1" }),
          makeUser("other-user")
        )
      ).toBe(false);
    });

    it("unlisted pool denies non-owner editing", () => {
      expect(
        canAddAnime(
          makePool({ visibility: Visibility.UNLISTED, creatorId: "owner-1" }),
          makeUser("other-user")
        )
      ).toBe(false);
    });

    it("archived pool denies editing even for owner", () => {
      expect(
        canAddAnime(
          makePool({ status: PoolStatus.ARCHIVED, deletedAt: new Date() }),
          makeUser("owner-1")
        )
      ).toBe(false);
    });

    it("public pool without allowPublicEdit denies non-owner editing", () => {
      expect(
        canAddAnime(
          makePool({ visibility: Visibility.PUBLIC, allowPublicEdit: false, creatorId: "owner-1" }),
          makeUser("other-user")
        )
      ).toBe(false);
    });

    it("public pool with allowPublicEdit allows non-owner editing", () => {
      expect(
        canAddAnime(
          makePool({ allowPublicEdit: true, creatorId: "owner-1" }),
          makeUser("other-user")
        )
      ).toBe(true);
    });
  });
});
