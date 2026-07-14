import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("season match UI", () => {
  const source = readFileSync("src/app/pools/[poolId]/seasons/[seasonId]/match/page.tsx", "utf8");

  it("uses AnimeCover fallback behavior instead of raw next image", () => {
    expect(source).toContain("<AnimeCover");
    expect(source).toContain("secondarySrc={secondarySrc}");
    expect(source).toContain("animeId={anime.animeId}");
    expect(source).not.toContain("import Image from \"next/image\"");
  });

  it("keeps the title overlay light so covers remain primary", () => {
    expect(source).toContain("from-slate-950/18");
    expect(source).toContain("bg-slate-950/24");
    expect(source).toContain("line-clamp-2");
  });

  it("lets users roll to another pair without submitting a vote", () => {
    expect(source).toContain("const handleRollPair = useCallback");
    expect(source).toContain("const filteredQueue = filterSeasonQueue(queue, nextSkippedPairKeys, unseenAnimeIds)");
    expect(source).toContain("换一组");
  });

  it("tracks skipped pair ids locally to avoid repeating same pairs", () => {
    expect(source).toContain("skippedPairKeys");
    expect(source).toContain("filterSeasonQueue");
    expect(source).toContain("seasonMatchPairKey");
    expect(source).toContain("skippedPairs.has(seasonMatchPairKey(item))");
    expect(source).toContain("nextSkippedPairKeys.add(seasonMatchPairKey(currentPair))");
    expect(source).toContain("setQueue(filtered)");
  });

  it("handleRollPair does not call submitSeasonVote", () => {
    const preHandleRoll = source.indexOf("const handleRollPair = useCallback");
    const rollBody = source.slice(preHandleRoll, preHandleRoll + 500);
    expect(rollBody).not.toContain("submitSeasonVote");
    expect(rollBody).toContain("filterSeasonQueue");
  });

  it("loads another queue batch after voting through the prefetched pairs", () => {
    expect(source).toContain("shouldLoadNextBatch");
    expect(source).toContain("currentIndex >= queue.length - 1");
    expect(source).toContain("result.votesRemaining <= 0 || shouldLoadNextBatch");
  });

  it("shows hint when no more new pairs after rolling", () => {
    expect(source).toContain("暂时没有更多可换组合");
    expect(source).toContain("可以先投当前组或稍后再试");
  });

  it("shows remaining-vote recovery when the local queue is empty", () => {
    expect(source).toContain("当前批次已投完");
    expect(source).toContain("获取下一批作品");
    expect(source).toContain("本批投完会自动获取下一批作品");
  });

  it("reserves a stable feedback slot so vote toasts do not push cards down", () => {
    expect(source).toContain("mt-2 min-h-[34px]");
    expect(source).toContain("sm:mt-4 sm:min-h-[42px]");
    expect(source).toContain('aria-atomic="true"');
    expect(source).toContain("已投票！第 {voteResult.stepNumber} 票");
    expect(source).toContain('<div className="mt-2 sm:mt-4">');
    expect(source).not.toContain('className="mt-5 rounded-xl border border-amber-300/20');
  });

  it("compresses the mobile first screen before the duel cards", () => {
    expect(source).toContain("hidden text-xs text-slate-500 sm:block");
    expect(source).toContain("const progressStatColumns");
    expect(source).toContain("grid-cols-5");
    expect(source).toContain("grid-cols-3");
    expect(source).toContain("hidden sm:inline");
    expect(source).toContain("sm:hidden");
    expect(source).toContain("mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4");
  });

  it("keeps the duel cards side by side on mobile", () => {
    expect(source).toContain("grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]");
    expect(source).toContain("sm:min-h-44");
    expect(source).toContain("sm:h-16 sm:w-16");
  });

  it("supports keyboard shortcuts like normal duel mode", () => {
    expect(source).toContain('e.key === "ArrowLeft"');
    expect(source).toContain('e.key === "ArrowRight"');
    expect(source).toContain('e.key === "ArrowDown"');
    expect(source).toContain('e.key === "1"');
    expect(source).toContain('e.key === "2"');
    expect(source).toContain('e.key === "3" || e.key === "0"');
    expect(source).toContain("isInteractiveShortcutTarget");
  });

  it("disables vote submission when today's season vote quota is exhausted", () => {
    expect(source).toContain("function getDailyVotesRemaining");
    expect(source).toContain("function canSubmitSeasonVote");
    expect(source).toContain("dailyVotesRemaining === null || dailyVotesRemaining > 0");
    expect(source).toContain("const canVote = canSubmitSeasonVote(detail)");
    expect(source).toContain("!canSubmitSeasonVote(detail)");
    expect(source).toContain("canUseVoteShortcut");
    expect(source).toContain("今日票数已用完");
    expect(source).toContain("今日剩余");
  });

  it("checks the schedule before loading a queue and explains unavailable voting states", () => {
    const detailIndex = source.indexOf("const d = await getSeasonDetail(poolId, seasonId)");
    const queueIndex = source.indexOf("const q = await getSeasonMatchQueue(poolId, seasonId");
    expect(source).toContain("getSeasonScheduleState");
    expect(detailIndex).toBeGreaterThan(-1);
    expect(queueIndex).toBeGreaterThan(detailIndex);
    expect(source).toContain("赛季还未开放投票");
    expect(source).toContain("投票已截止");
  });

  it("lets users mark unseen anime without submitting a vote", () => {
    expect(source).toContain("const handleMarkUnseen = useCallback");
    expect(source).toContain("LEFT_UNSEEN");
    expect(source).toContain("RIGHT_UNSEEN");
    expect(source).toContain("BOTH_UNSEEN");
    expect(source).toContain("writeSeasonUnseenAnimeIds");
    expect(source).toContain("hiddenAnimeIds.has(item.left.animeId)");
    expect(source).toContain("hiddenAnimeIds.has(item.right.animeId)");
    const preHandleUnseen = source.indexOf("const handleMarkUnseen = useCallback");
    const unseenBody = source.slice(preHandleUnseen, preHandleUnseen + 1400);
    expect(unseenBody).not.toContain("submitSeasonVote");
  });

  it("shows explicit unseen and reset controls", () => {
    expect(source).toContain("左边没看过");
    expect(source).toContain("右边没看过");
    expect(source).toContain("都没看过");
    expect(source).toContain("恢复已排除");
  });
  it("keeps load and submit errors retryable without discarding an existing pair", () => {
    expect(source).toContain("setError(null);");
    expect(source).toContain("loading && detail === null");
    expect(source).toContain("error && detail === null");
    expect(source).toContain("void fetchData(skippedPairKeys, unseenAnimeIds)");
    expect(source).toContain("error ? (");
    expect(source).toContain("重新获取对局");
  });
});
