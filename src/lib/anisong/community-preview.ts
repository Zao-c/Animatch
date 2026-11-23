import { makePairKey } from "@/lib/pair-key";
import type { SongDecision } from "./types";

export type CommunityPairVote = {
  ownerId:string;leftId:string;rightId:string;result:SongDecision;
};
export type CommunityPreviewScore = {
  id:string;score:number;participants:number;comparisons:number;
  sampleStatus:"limited"|"growing"|"broader";
};

/** Explicitly exploratory Bradley–Terry fit. Per-account/pair repetition does not
 * increase weight; regularization pulls sparse, disconnected scores towards 1500.
 * Do not confuse this score or sampleStatus with a calibrated confidence interval. */
export function communityRatingPreview(trackIds:string[],votes:CommunityPairVote[]):CommunityPreviewScore[] {
  const ids=[...new Set(trackIds)];
  const index=new Map(ids.map((id,i)=>[id,i]));
  const latest=new Map<string,CommunityPairVote>();
  for(const v of votes) {
    if(!index.has(v.leftId)||!index.has(v.rightId)||v.leftId===v.rightId||
      !["LEFT_WIN","RIGHT_WIN","DRAW"].includes(v.result))continue;
    const key=v.ownerId+"\u001f"+makePairKey(v.leftId,v.rightId);
    latest.set(key,v); // last effective vote from the account replaces earlier repeats
  }
  const data=[...latest.values()];
  const participants=ids.map(()=>new Set<string>());
  const counts=new Array<number>(ids.length).fill(0);
  const matches=data.map(v=>{
    const left=index.get(v.leftId)!,right=index.get(v.rightId)!;
    participants[left].add(v.ownerId);participants[right].add(v.ownerId);
    counts[left]++;counts[right]++;
    return {left,right,outcome:v.result==="LEFT_WIN"?1:v.result==="RIGHT_WIN"?0:.5};
  });
  // Regularized logit strengths with 2 prior-information units per song.
  // This is a preview index, not equivalent to a player's personal Elo.
  const prior=2, strength=new Array<number>(ids.length).fill(0);
  for(let iteration=0;iteration<85;iteration++){
    const grad=new Array<number>(ids.length).fill(0);
    const hessian=new Array<number>(ids.length).fill(prior);
    for(const m of matches){
      const p=1/(1+Math.exp(-(strength[m.left]-strength[m.right])));
      const error=m.outcome-p, information=p*(1-p);
      grad[m.left]+=error;grad[m.right]-=error;
      hessian[m.left]+=information;hessian[m.right]+=information;
    }
    let maxChange=0;
    for(let i=0;i<ids.length;i++){
      const delta=.45*(grad[i]-prior*strength[i])/hessian[i];
      strength[i]=Math.max(-4,Math.min(4,strength[i]+delta));
      maxChange=Math.max(maxChange,Math.abs(delta));
    }
    if(maxChange<1e-6)break;
  }
  return ids.map((id,i)=>({
    id,score:Math.round((1500+strength[i]*160)*10)/10,
    participants:participants[i].size,comparisons:counts[i],
    sampleStatus:participants[i].size>=10?"broader":participants[i].size>=3?"growing":"limited"
  }));
}
