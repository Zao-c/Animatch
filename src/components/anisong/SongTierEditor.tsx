"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { registerUnsavedChangesGuard } from "@/lib/unsaved-changes-guard";
import { KIND_LABELS, type SongSnapshot } from "@/lib/anisong/types";
import { SongCover } from "./SongCover";
import { SongTierView } from "./SongTierView";

const TIERS = ["s", "a", "b", "c", "d"] as const;
type Rows = Record<string, string[]>;
type Song = SongSnapshot["rows"][number]["songs"][number];

function snapshotRows(snapshot: SongSnapshot): Rows {
  return Object.fromEntries(snapshot.rows.map(row => [row.id, row.songs.map(song => song.id)]));
}
function cloneRows(rows: Rows): Rows {
  return Object.fromEntries(Object.entries(rows).map(([tier, songs]) => [tier, [...songs]]));
}

/** Move a track, including a previously unranked candidate, to an editable tier. */
export function moveSongInTierLayout(rows: Rows, trackId: string, target: string, before?: string): Rows {
  if (!TIERS.some(tier => tier === target)) return rows;
  const original = Object.entries(rows).find(([, songs]) => songs.includes(trackId))?.[0];
  if (!original || original === "hidden" || original === "excluded" || before === trackId) return rows;
  const next = cloneRows(rows);
  for (const songs of Object.values(next)) {
    const index = songs.indexOf(trackId);
    if (index !== -1) songs.splice(index, 1);
  }
  const position = before ? next[target].indexOf(before) : -1;
  next[target].splice(position === -1 ? next[target].length : position, 0, trackId);
  return next;
}

export function SongTierEditor({ snapshot, busy, onSave, onReset, onEditingChange }: {
  snapshot: SongSnapshot; busy: boolean;
  onSave: (rows: Rows) => Promise<boolean>; onReset: () => Promise<boolean>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Rows>(() => snapshotRows(snapshot));
  const [undoStack, setUndoStack] = useState<Rows[]>([]);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const touchOrder = useMemo(() => snapshot.rows.filter(row => row.id !== "hidden").map(row => row.id), [snapshot]);
  const songs = useMemo(() => new Map(snapshot.rows.flatMap(row => row.songs.map(song => [song.id, song] as const))), [snapshot]);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    if (snapshot === snapshotRef.current) return;
    snapshotRef.current = snapshot;
    setRows(snapshotRows(snapshot));
    setUndoStack([]);
    setEditing(false);
    onEditingChange?.(false);
  }, [snapshot, onEditingChange]);
  useEffect(() => {
    if (!editing || !undoStack.length) return;
    return registerUnsavedChangesGuard(window, "音乐 Tier List 有未保存的排序，确定放弃修改吗？");
  }, [editing, undoStack.length]);

  function toggleEditing(next: boolean) {
    if (next) { setRows(snapshotRows(snapshot)); setUndoStack([]); setStatus(""); }
    else { setDragSource(null); setStatus(""); }
    setEditing(next);
    onEditingChange?.(next);
  }

  function move(id: string, target: string, before?: string) {
    if (!editing || busy || saving) return;
    const updated = moveSongInTierLayout(rows, id, target, before);
    if (updated === rows || JSON.stringify(updated) === JSON.stringify(rows)) return;
    setUndoStack(previous => [...previous.slice(-19), cloneRows(rows)]);
    setRows(updated);
    setStatus("已调整歌曲位置；点击保存排序后才会写入数据库");
  }

  async function save() {
    if (saving || busy || !undoStack.length) return;
    setSaving(true);
    try {
      if (await onSave(Object.fromEntries(touchOrder.map(row => [row, [...(rows[row] ?? [])]])))) {
        toggleEditing(false);
      } else {
        setStatus("保存失败。排序草稿仍在当前页面，请处理错误后重试。");
      }
    } finally { setSaving(false); }
  }
  async function reset() {
    if (busy || saving || editing || !window.confirm("恢复当前参赛歌曲的自动分档及顺序？对决历史和 Elo 不会删除。")) return;
    setSaving(true);
    try { if (!(await onReset())) setStatus("恢复自动分档失败，请重试。"); }
    finally { setSaving(false); }
  }

  if (!editing) return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <AppButton disabled={busy || saving} onClick={() => toggleEditing(true)}>编辑 Tier 排序</AppButton>
      <AppButton variant="ghost" disabled={busy || saving} onClick={() => void reset()}>恢复自动分档</AppButton>
    </div>
    {status && <p role="status" className="text-xs text-amber-200">{status}</p>}
    <SongTierView snapshot={snapshot} busy={busy} />
  </div>;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-anime-cyan/25 bg-slate-950/35 p-3">
      <div>
        <p className="font-semibold">正在编辑音乐 Tier List</p>
        <p className="mt-1 text-xs text-slate-400">电脑拖动歌曲到档位或其他歌曲前；手机用分档选择和前移、后移。更改不会修改 Elo。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AppButton variant="ghost" disabled={busy || saving || !undoStack.length} onClick={() => { const prev = undoStack.at(-1); if (!prev) return; setRows(prev); setUndoStack(stack => stack.slice(0,-1)); setStatus("已撤销上一次未保存的移动"); }}>撤销移动</AppButton>
        <AppButton disabled={busy || saving || !undoStack.length} onClick={() => void save()}>{saving ? "保存中…" : "保存排序"}</AppButton>
        <AppButton variant="ghost" disabled={busy || saving} onClick={() => toggleEditing(false)}>取消编辑</AppButton>
      </div>
    </div>
    {status && <p role="status" className="text-xs text-slate-300">{status}</p>}
    <div className="overflow-hidden rounded-2xl border border-white/10">
      {snapshot.rows.map(row => {
        const movable = TIERS.some(tier => tier === row.id);
        const rowSongs = (rows[row.id] ?? []).map(id => songs.get(id)).filter((song): song is Song => Boolean(song));
        return <div key={row.id} className="grid min-h-24 grid-cols-[64px_minmax(0,1fr)] border-b border-white/10 last:border-b-0 sm:grid-cols-[96px_minmax(0,1fr)]">
          <div style={{ backgroundColor: row.color }} className="flex items-center justify-center px-2 text-center text-xl font-black text-slate-950 sm:text-2xl">{row.label}</div>
          <div className={"flex min-h-24 flex-wrap items-start gap-2 p-3 " + (movable ? "bg-slate-950/25" : "bg-slate-950/45")}
            onDragOver={event => { if (movable && dragSource) event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); if (dragSource && movable) move(dragSource, row.id); setDragSource(null); }}>
            {rowSongs.length ? rowSongs.map((song, index) => <article key={song.id}
              draggable={!busy && !saving && row.id !== "hidden"}
              onDragStart={event => { setDragSource(song.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", song.id); }}
              onDragEnd={() => setDragSource(null)}
              onDragOver={event => { if (movable && dragSource && dragSource !== song.id) event.preventDefault(); }}
              onDrop={event => { event.stopPropagation(); event.preventDefault(); if (dragSource && movable) move(dragSource, row.id, song.id); setDragSource(null); }}
              className="w-[calc(50%-4px)] min-w-0 rounded-xl border border-white/10 bg-slate-800/70 p-2 sm:w-40">
              <SongCover src={song.coverUrl} title={song.title} className="mb-2 w-full" />
              <p className="break-words text-sm font-semibold">{song.title}</p>
              <p className="mt-1 break-words text-xs text-slate-400">{song.artist || "歌手未填写"}</p>
              <p className="mt-1 break-words text-xs text-anime-cyan">{KIND_LABELS[song.kind]}{song.anime ? " · " + song.anime : ""}</p>
              {row.id !== "hidden" && <div className="mt-2 space-y-2">
                <select aria-label={song.title + " 移动到档位"} value={row.id} disabled={busy || saving} className="anime-field w-full text-xs" onChange={event => move(song.id, event.target.value)}>
                  {row.id === "pending" && <option value="pending">待比较</option>}
                  {snapshot.rows.filter(r => TIERS.some(t => t === r.id)).map(target => <option value={target.id} key={target.id}>{target.label}</option>)}
                </select>
                {movable && <div className="flex gap-1">
                  <button type="button" disabled={busy || saving || index === 0} onClick={() => move(song.id, row.id, rowSongs[index-1]?.id)} className="min-h-9 flex-1 rounded-md border border-white/15 text-xs disabled:opacity-30">↑ 前移</button>
                  <button type="button" disabled={busy || saving || index >= rowSongs.length-1} onClick={() => move(rowSongs[index+1].id, row.id, song.id)} className="min-h-9 flex-1 rounded-md border border-white/15 text-xs disabled:opacity-30">↓ 后移</button>
                </div>}
              </div>}
            </article>) : <span className="self-center text-sm text-slate-500">{movable ? "拖动歌曲到这里" : "暂无歌曲"}</span>}
          </div>
        </div>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
      <AppButton disabled={busy || saving || !undoStack.length} onClick={() => void save()}>保存排序</AppButton>
      <AppButton variant="ghost" disabled={busy || saving} onClick={() => toggleEditing(false)}>取消编辑</AppButton>
    </div>
  </div>;
}
