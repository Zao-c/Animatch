"use client";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { songRequest } from "@/lib/anisong/client";
import type { SongBoardView } from "@/lib/anisong/types";
import type { SongVersionDiff } from "@/lib/anisong/template-version";

type Preview = {unavailable:boolean;outdated:boolean;currentRevision:number;latestRevision?:number;diff?:SongVersionDiff};
export function SongVersionUpdateNotice({board,onApplied,disabled}:{
  board:SongBoardView;onApplied:(next:SongBoardView)=>void;disabled:boolean;
}) {
  const [preview,setPreview]=useState<Preview|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!board.templateId) return;
    const controller=new AbortController();
    setLoading(true);setError("");
    songRequest<Preview>("/api/anisong/boards/"+board.id+"/template-update",{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setPreview(data);})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"检查新版本失败");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[board.id,board.templateId,board.templateRevision,retry]);
  async function apply(includeNew:boolean) {
    if(!preview?.latestRevision||disabled||busy) return;
    setBusy(true);setError("");
    try{
      const result=await songRequest<SongBoardView>("/api/anisong/boards/"+board.id+"/template-update",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({revision:board.revision,targetRevision:preview.latestRevision,includeNew})
      });
      setPreview(null);onApplied(result);
    }catch(e){setError(e instanceof Error?e.message:"更新失败，请重新载入");}
    finally{setBusy(false);}
  }
  if(!board.templateId || loading&&!preview || !preview&&!error || preview&&!preview.outdated&&!preview.unavailable&&!error) return null;
  const diff=preview?.diff;
  return <section aria-label="公开曲单版本更新" className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.045] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-bold text-cyan-100">{preview?.unavailable?"原公开曲单已下架":"公开曲单有新版本"}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-300">{preview?.unavailable?"个人历史仍可保留，但无法同步已下架的曲单。":
        "个人版本 v"+(preview?.currentRevision??0)+" → 公开版本 v"+(preview?.latestRevision??"?")+"。更新需要你主动确认。"}</p></div>
      {error&&<AppButton size="sm" variant="ghost" onClick={()=>setRetry(n=>n+1)}>重新检查</AppButton>}
    </div>
    {error&&<p role="alert" className="mt-2 text-xs text-amber-200">{error}</p>}
    {diff&&!preview?.unavailable&&<details className="mt-3 rounded-lg border border-white/10 p-3 text-xs text-slate-300">
      <summary className="min-h-9 cursor-pointer font-semibold text-white">
        查看变更 · 新增 {diff.added.length} · 移除 {diff.removed.length} · 信息修改 {diff.metadataChanged.length} · 身份变化 {diff.identityChanged.length}
      </summary>
      <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
        {([["新增歌曲",diff.added],["已移除",diff.removed],["信息或音源修改",diff.metadataChanged],["歌曲身份变化",diff.identityChanged]] as const)
          .filter(([,items])=>items.length>0).map(([label,items])=><p key={label}><strong>{label}：</strong>{items.slice(0,12).map(t=>t.title).join("、")}{items.length>12?" 等 "+items.length+" 首":""}</p>)}
        {diff.changes===0&&<p>歌曲没有检测到实质变化，主要是曲单版本更新。</p>}
        <p className="leading-5 text-slate-400">旧投票和手动 Tier 保留；移除的歌曲不再参加新对决，历史记录不删除。新增歌曲只在确认后加入。</p>
      </div>
    </details>}
    {!!diff?.identityChanged.length&&<p className="mt-3 text-xs leading-5 text-amber-200">
      有歌曲编号被复用为不同歌曲。为防止旧投票被误算，暂时阻止自动升级；请创建者为替换歌曲使用新的 ID。
    </p>}
    {preview?.outdated&&!preview.unavailable&&!diff?.identityChanged.length&&<div className="mt-3 flex flex-wrap gap-2">
      <AppButton size="sm" variant="secondary" disabled={disabled||busy} onClick={()=>void apply(false)}>{busy?"正在更新…":"仅同步已有歌曲信息"}</AppButton>
      {!!diff?.added.length&&<AppButton size="sm" variant="primary" disabled={disabled||busy} onClick={()=>void apply(true)}>同步并加入 {diff.added.length} 首新歌</AppButton>}
    </div>}
  </section>;
}
