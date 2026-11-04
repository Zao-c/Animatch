import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySongDocument } from "@/lib/anisong/types";
import { startSongTemplate, templateSummary } from "@/lib/anisong/shared/templates";

const mocks = vi.hoisted(() => ({ template: vi.fn(), source: vi.fn(), existing: vi.fn(), count: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  songTemplate: { findFirst: mocks.template },
  songBoard: { findFirst: mocks.source, findUnique: mocks.existing, count: mocks.count, upsert: mocks.upsert }
} }));
const document = emptySongDocument();
const board = { id: "source", title: "Owner", ownerId: "owner", revision: 4, document,
  templateId: null, templateRevision: null, shareToken: null, snapshot: null,
  updatedAt: new Date("2026-11-04T00:00:00Z") };
const template = { id: "public", title: "Owner", ownerId: "owner", sourceBoardId: "source", document,
  revision: 2, updatedAt: board.updatedAt, owner: { name: "Owner", username: "owner" } };
beforeEach(() => {
  vi.resetAllMocks(); mocks.template.mockResolvedValue(template); mocks.source.mockResolvedValue(board);
  mocks.existing.mockResolvedValue(null); mocks.count.mockResolvedValue(0);
  mocks.upsert.mockResolvedValue({ ...board, id: "participant", templateId: "public" });
});
describe("public playlist start isolation", () => {
  it("returns the creator's source board even when a legacy duplicate run exists", async () => {
    mocks.existing.mockResolvedValue({ ...board, id: "legacy-copy", templateId: "public" });
    expect((await startSongTemplate("owner", "public")).id).toBe("source");
    expect(mocks.source).toHaveBeenCalledWith({ where: { id: "source", ownerId: "owner" } });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("creates an independent run for another account without accessing private source data", async () => {
    expect((await startSongTemplate("visitor", "public")).id).toBe("participant");
    expect(mocks.source).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ ownerId: "visitor", templateId: "public" })
    }));
  });
  it("retains a participant's progress when the original playlist is taken down", async () => {
    mocks.template.mockResolvedValue(null);
    mocks.existing.mockResolvedValue({ ...board, id: "saved", templateId: "public" });
    expect((await startSongTemplate("visitor", "public")).id).toBe("saved");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("exposes the source board link only to its owner", () => {
    expect(templateSummary(template, "owner").ownerBoardId).toBe("source");
    expect(templateSummary(template, "visitor")).not.toHaveProperty("ownerBoardId");
    expect(templateSummary(template)).not.toHaveProperty("ownerBoardId");
  });
});
