import { beforeEach, describe, expect, it, vi } from "vitest";
import { controlAwardLive } from "../src/lib/award-live-service";
import { prisma } from "../src/lib/db";
import { lockedEvent } from "../src/lib/award-service";

vi.mock("../src/lib/db", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("../src/lib/award-service", () => ({ ensurePublishedSnapshot: vi.fn(), lockedEvent: vi.fn() }));
const tx = {
  user: { findUnique: vi.fn() }, awardRound: { findFirst: vi.fn() }, awardDecision: { findUnique: vi.fn() },
  awardStage: { upsert: vi.fn() }, awardEventLog: { create: vi.fn() }, awardCeremony: { update: vi.fn() }
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
  vi.mocked(lockedEvent).mockResolvedValue({ id: "event", ownerId: "host", status: "LIVE", revision: 4, awards: [{ id: "a" }], publishedSnapshot: [] } as any);
  tx.user.findUnique.mockResolvedValue({ deletedAt: null });
  tx.awardRound.findFirst.mockResolvedValue(null);
  tx.awardDecision.findUnique.mockResolvedValue({ revealedAt: null });
  tx.awardCeremony.update.mockResolvedValue({ revision: 5 });
});
describe("host stage transitions", () => {
  it("clears the award on waiting even when a previous winner exists", async () => {
    tx.awardDecision.findUnique.mockResolvedValue({ revealedAt: new Date() });
    await controlAwardLive("event", "host", { action: "wait", awardId: "a", revision: 4 });
    expect(tx.awardStage.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { scene: "WAITING", awardId: null } }));
  });
  it("keeps a confirmed but unrevealed award in the waiting-for-reveal phase", async () => {
    await controlAwardLive("event", "host", { action: "show", awardId: "a", revision: 4 });
    expect(tx.awardStage.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { scene: "READY", awardId: "a" } }));
  });
  it("still forbids switching to waiting while votes are open", async () => {
    tx.awardRound.findFirst.mockResolvedValue({ id: "round", awardId: "a" });
    await expect(controlAwardLive("event", "host", { action: "wait", awardId: "a", revision: 4 })).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.awardStage.upsert).not.toHaveBeenCalled();
    expect(tx.awardEventLog.create).not.toHaveBeenCalled();
  });
});
