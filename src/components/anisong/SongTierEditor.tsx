"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { registerUnsavedChangesGuard } from "@/lib/unsaved-changes-guard";
import { type SongSnapshot } from "@/lib/anisong/types";
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
  const [compact, setCompact] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setSelectedId(null);
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

  const displaySnapshot: SongSnapshot = editing ? { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, songs: (rows[row.id] ?? []).map(id => songs.get(id)).filter((song): song is Song => Boolean(song)) })) } : snapshot;
  const selectedRow = selectedId ? Object.keys(rows).find(id => rows[id].includes(selectedId)) : undefined;
  const selectedIndex = selectedRow && selectedId ? rows[selectedRow].indexOf(selectedId) : -1;
  const locked = busy || saving;
  function cancelEditing() {
    if (undoStack.length && !window.confirm("放弃尚未保存的排序调整？")) return;
    toggleEditing(false);
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {!editing ? <AppButton size="sm" variant="secondary" disabled={locked} onClick={() => toggleEditing(true)}>调整排序</AppButton> : <>
        <AppButton size="sm" variant="primary" disabled={locked || !undoStack.length} onClick={() => void save()}>{saving ? "保存中…" : "保存排序"}</AppButton>
        <AppButton size="sm" variant="secondary" disabled={locked || !undoStack.length} onClick={() => { const prev = undoStack.at(-1); if (!prev) return; setRows(prev); setUndoStack(stack => stack.slice(0,-1)); setStatus("已撤销上一次移动"); }}>撤销移动</AppButton>
        <AppButton size="sm" variant="quiet" disabled={locked} onClick={cancelEditing}>取消编辑</AppButton>
      </>}
      <AppButton size="sm" variant="secondary" aria-pressed={!compact} onClick={() => setCompact(value => !value)}>{compact ? "切换大图详情" : "切换紧凑总览"}</AppButton>
      {!editing && <AppButton size="sm" variant="quiet" disabled={locked} onClick={() => void reset()}>恢复自动分档</AppButton>}
    </div>
    {editing && <div className="sticky top-2 z-10 space-y-2 rounded-xl border border-anime-cyan/25 bg-slate-950/95 p-3">
      <p className="text-xs text-slate-300">拖动封面跨档或调整顺序；也可点选歌曲，再使用下方控件。</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 max-w-48 truncate text-xs text-cyan-100">{selectedId ? songs.get(selectedId)?.title : "请选择歌曲"}</span>
        <select aria-label="选中歌曲移动到档位" disabled={locked || !selectedId} value={TIERS.some(id => id === selectedRow) ? selectedRow : ""} className="anime-field !w-auto text-xs" onChange={event => { if (selectedId) move(selectedId, event.target.value); }}><option value="" disabled>移动到…</option>{TIERS.map(id => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select>
        <AppButton size="sm" variant="secondary" disabled={locked || !selectedId || !selectedRow || selectedIndex <= 0 || !TIERS.some(id => id === selectedRow)} onClick={() => { if (selectedId && selectedRow) move(selectedId, selectedRow, rows[selectedRow][selectedIndex - 1]); }}>前移</AppButton>
        <AppButton size="sm" variant="secondary" disabled={locked || !selectedId || !selectedRow || selectedIndex >= rows[selectedRow].length - 1 || !TIERS.some(id => id === selectedRow)} onClick={() => { if (selectedId && selectedRow) move(rows[selectedRow][selectedIndex + 1], selectedRow, selectedId); }}>后移</AppButton>
      </div>
    </div>}
    {status && <p role="status" className="text-xs text-slate-300">{status}</p>}
    <div role="region" aria-label="歌曲分层榜单" tabIndex={0} className="max-h-[70dvh] overflow-y-auto overscroll-contain pr-1">
      <SongTierView snapshot={displaySnapshot} busy={locked} compact={compact} editing={editing} selectedId={selectedId} dragSource={dragSource} onSelect={setSelectedId} onDragSource={setDragSource} onMove={move} />
    </div>
  </div>;
}
