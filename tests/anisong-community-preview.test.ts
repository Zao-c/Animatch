import { describe,expect,it } from "vitest";
import { communityRatingPreview, type CommunityPairVote } from "@/lib/anisong/community-preview";
const v=(ownerId:string,result:CommunityPairVote["result"]):CommunityPairVote=>({ownerId,leftId:"a",rightId:"b",result});
describe("experimental community Bradley–Terry preview",()=>{
  it("ranks winners above losers but keeps unconnected songs at the prior",()=>{
    const ratings=communityRatingPreview(["a","b","unseen"],[v("u1","LEFT_WIN"),v("u2","LEFT_WIN")]);
    expect(ratings[0].score).toBeGreaterThan(ratings[1].score);
    expect(ratings[2].score).toBe(1500);
    expect(ratings[0].sampleStatus).toBe("limited");
  });
  it("one user repeating the same pair does not inflate the result",()=>{
    const one=communityRatingPreview(["a","b"],[v("u1","LEFT_WIN")]);
    const repeated=communityRatingPreview(["a","b"],[v("u1","LEFT_WIN"),v("u1","LEFT_WIN"),v("u1","LEFT_WIN")]);
    expect(repeated).toEqual(one);
    expect(repeated[0].participants).toBe(1);
    expect(repeated[0].comparisons).toBe(1);
  });
  it("a changed last vote replaces a user's earlier preference",()=>{
    const result=communityRatingPreview(["a","b"],[v("u1","LEFT_WIN"),v("u1","RIGHT_WIN")]);
    expect(result[1].score).toBeGreaterThan(result[0].score);
  });
  it("balanced draws remain neutral and unrecognized songs are excluded",()=>{
    const result=communityRatingPreview(["a","b"],[v("u1","DRAW"),
      {ownerId:"u2",leftId:"missing",rightId:"a",result:"LEFT_WIN"}]);
    expect(result[0].score).toBeCloseTo(1500);
    expect(result[1].score).toBeCloseTo(1500);
  });
});
