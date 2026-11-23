import { describe, expect, it } from "vitest";
import { chooseQuickSongPair, quickMatchProgress } from "@/lib/anisong/quick-match";
import type { SongEvent } from "@/lib/anisong/types";
import type { ScoreItem } from "@/lib/ranking-pairing";

function scores(counts: number[]) {
  return counts.map((c,i): ScoreItem => ({
    animeId: String(i),eloScore: 1500+i,uncertainty:350,compareCount:c
  }));
}
function vote(a: number,b: number): SongEvent {
  return {id: a+"-"+b,leftId:String(a),rightId:String(b),result:"LEFT_WIN"};
}
describe("Quick Match coverage", () => {
  it("bridges disconnected song groups before fine calibration", () => {
    const p=chooseQuickSongPair(scores([1,1,1,1]),[vote(0,1),vote(2,3)],()=>.5);
    expect(p).not.toBeNull();
    expect((Number(p![0])<2)!==(Number(p![1])<2)).toBe(true);
  });
  it("does not call disconnected or partially heard songs a completed draft", () => {
    expect(quickMatchProgress(scores([2,2,2,2]),[vote(0,1),vote(2,3)]).readyForDraft).toBe(false);
    expect(quickMatchProgress(scores([2,0]),[vote(0,1)]).readyForDraft).toBe(false);
  });
  it("reports readiness only with two comparisons per active song and a connected graph", () => {
    expect(quickMatchProgress(scores([2,2,2,2]),[vote(0,1),vote(1,2),vote(2,3),vote(0,3)]).readyForDraft).toBe(true);
  });
  it("excludes songs marked unseen and never mutates events", () => {
    const all=scores([0,0,0]);all[2].isHidden=true;
    const events=[vote(0,1)], before=JSON.stringify(events);
    expect(chooseQuickSongPair(all,events,()=>.5)?.includes("2")).toBe(false);
    expect(JSON.stringify(events)).toBe(before);
  });
  it("covers an annual 256-song pool without a quadratic all-pairs loop per vote", () => {
    const all=scores(Array(256).fill(0));
    const events:SongEvent[]=[];
    for(let turn=0;turn<256;turn++){
      const pair=chooseQuickSongPair(all,events,()=>.5);
      expect(pair).not.toBeNull();
      const [left,right]=pair!;
      all[Number(left)].compareCount++;
      all[Number(right)].compareCount++;
      events.push({id:String(turn),leftId:left,rightId:right,result:"LEFT_WIN"});
    }
    const coverage=quickMatchProgress(all,events);
    expect(coverage).toMatchObject({covered:256,total:256,components:1,readyForDraft:true});
  });
});
