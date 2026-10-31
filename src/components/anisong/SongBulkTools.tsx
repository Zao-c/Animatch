"use client";
import { useState, type FormEvent } from "react";
import { SongEditDrawer } from "./SongEditDrawer";
import { AppButton } from "@/components/ui/AppButton";
import { KIND_LABELS, SONG_KINDS, type SongTrack } from "@/lib/anisong/types";

function BulkForm({ tracks, selected, disabled, onSave, onClose }: {
  tracks: SongTrack[]; selected: SongTrack[]; disabled: boolean;
  onSave: (ids: string[], patch: Record<string, string>) => Promise<boolean>; onClose: () => void;
}) {
  // Freeze the target list while editing, including across conflict reloads.
  const [targets] = useState(selected);
  const [fields, setFields] = useState<string[]>([]);
  const missing = targets.some(t => !tracks.some(current => current.id === t.id));
  const labels = { anime: "所属动画", kind: "歌曲类型", year: "播出年份", quarter: "季度", tags: "风格标签" };
  function applyField(name: string) {
    return <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-teal-300" checked={fields.includes(name)} onChange={e => setFields(previous => e.target.checked ? [...previous, name] : previous.filter(f => f !== name))} />修改{labels[name as keyof typeof labels]}</label>;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || missing || !fields.length) return;
    const data = new FormData(event.currentTarget);
    const patch = Object.fromEntries(fields.map(name => [name, String(data.get(name) ?? "")]));
    if (await onSave(targets.map(t => t.id), patch)) onClose();
  }
  return <form onSubmit={submit} className="space-y-4 rounded-xl border border-anime-cyan/20 bg-slate-950/40 p-4">
    <div><h3 className="font-semibold">批量修改 {targets.length} 首歌曲</h3><p className="mt-2 break-words text-xs leading-5 text-slate-400">{targets.map(t => t.title).join("、")}</p><p className="mt-2 text-sm leading-6 text-slate-300">勾选要修改的字段。未勾选的字段保持原值；勾选后留空会清除该字段。</p></div>
    {missing && <p role="alert" className="text-sm text-amber-200">部分目标歌曲已被移除。请取消批量编辑，重新选择歌曲。</p>}
    <fieldset disabled={disabled || missing} className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>{applyField("anime")}<input name="anime" aria-label="统一所属动画" disabled={!fields.includes("anime")} maxLength={120} placeholder="填写动画名称，留空可清除" className="anime-field" /></div>
        <div>{applyField("kind")}<select name="kind" aria-label="统一歌曲类型" disabled={!fields.includes("kind")} className="anime-field">{SONG_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></div>
        <div>{applyField("year")}<input name="year" aria-label="统一播出年份" disabled={!fields.includes("year")} type="number" min={1900} max={2100} step={1} placeholder="如 2026；留空可清除" className="anime-field" /></div>
        <div>{applyField("quarter")}<select name="quarter" aria-label="统一季度" disabled={!fields.includes("quarter")} className="anime-field"><option value="">清除季度</option>{["冬季", "春季", "夏季", "秋季"].map((q, i) => <option key={q} value={i + 1}>{q}</option>)}</select></div>
      </div>
      <div>{applyField("tags")}<input name="tags" aria-label="统一风格标签" disabled={!fields.includes("tags")} maxLength={160} placeholder="摇滚, 治愈（替换原有标签；留空可清除）" className="anime-field" /></div>
      <AppButton type="submit" disabled={!fields.length}>保存到这 {targets.length} 首</AppButton>
    </fieldset>
    <AppButton type="button" variant="ghost" disabled={disabled} onClick={() => { if (!fields.length || window.confirm("放弃尚未保存的批量修改？")) onClose(); }}>取消批量编辑</AppButton>
  </form>;
}

export function SongBulkTools({ tracks, visible, selectedIds, hiddenIds, candidateIds, disabled, open, onOpen, onSelection, onSave, onCandidates }: {
  tracks: SongTrack[]; visible: SongTrack[]; selectedIds: string[]; hiddenIds: string[]; candidateIds: string[] | null;
  disabled: boolean; open: boolean; onOpen: (value: boolean) => void; onSelection: (ids: string[]) => void;
  onSave: (ids: string[], patch: Record<string, string>) => Promise<boolean>;
  onCandidates: (ids: string[], mode: "include" | "exclude" | "only") => Promise<boolean>;
}) {
  const selected = tracks.filter(t => selectedIds.includes(t.id));
  const outside = selected.filter(t => !visible.some(v => v.id === t.id)).length;
  const allVisible = visible.length > 0 && visible.every(t => selectedIds.includes(t.id));
  const unheard = selected.filter(t => hiddenIds.includes(t.id)).length;
  const candidates = candidateIds ?? tracks.map(t => t.id);
  const addCount = selected.filter(t => !candidates.includes(t.id)).length;
  const removeCount = selected.filter(t => candidates.includes(t.id)).length;
  return <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><span role="status" className="text-sm font-semibold">已选 {selected.length} 首</span><div className="flex flex-wrap gap-2"><AppButton type="button" size="sm" variant="ghost" disabled={disabled || open || !visible.length} onClick={() => onSelection(allVisible ? selectedIds.filter(id => !visible.some(t => t.id === id)) : [...new Set([...selectedIds, ...visible.map(t => t.id)])])}>{allVisible ? "取消选择筛选结果" : `全选筛选结果（${visible.length}）`}</AppButton><AppButton type="button" size="sm" variant="quiet" disabled={disabled || open || !selected.length} onClick={() => onSelection([])}>清空选择</AppButton></div></div>
    {outside > 0 && <p className="text-sm text-amber-200">已选歌曲中有 {outside} 首不在当前筛选结果中，批量操作仍会包含它们。<button type="button" disabled={disabled || open} className="ml-2 min-h-11 underline disabled:opacity-50" onClick={() => onSelection(selectedIds.filter(id => visible.some(t => t.id === id)))}>仅保留可见选择</button></p>}
    {unheard > 0 && <p className="text-xs leading-5 text-slate-400">已选歌曲中有 {unheard} 首标记为「未听过」；加入参赛范围后，仍需在歌曲卡片中恢复才能对决。</p>}
    {open ? <SongEditDrawer busy={disabled} onClose={() => { if (window.confirm("放弃未保存的批量编辑？")) onOpen(false); }}><BulkForm tracks={tracks} selected={selected} disabled={disabled} onSave={onSave} onClose={() => onOpen(false)} /></SongEditDrawer> : <div className="flex flex-wrap gap-2">
      <AppButton type="button" size="sm" disabled={disabled || !selected.length} onClick={() => onOpen(true)}>批量编辑信息</AppButton>
      <AppButton type="button" size="sm" variant="ghost" disabled={disabled || selected.length - unheard < 2} onClick={() => void onCandidates(selected.map(t => t.id), "only")}>仅用已选 {selected.length} 首对决</AppButton>
      <AppButton type="button" size="sm" variant="quiet" disabled={disabled || !addCount} onClick={() => void onCandidates(selected.map(t => t.id), "include")}>加入参赛范围（{addCount}）</AppButton>
      <AppButton type="button" size="sm" variant="quiet" disabled={disabled || !removeCount || candidates.length - removeCount < 2} onClick={() => void onCandidates(selected.map(t => t.id), "exclude")}>移出参赛范围（{removeCount}）</AppButton>
    </div>}
    <p className="text-xs leading-5 text-slate-500">参赛范围至少保留两首。批量修改信息与调整范围均保留已有音频、封面和对决历史。</p>
  </div>;
}
