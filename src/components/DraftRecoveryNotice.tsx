"use client";

import { AppButton } from "./ui/AppButton";

export function DraftRecoveryNotice({ changed, onRestore, onDiscard }: {
  changed: boolean; onRestore: () => void; onDiscard: () => void;
}) {
  return <section aria-label="恢复未保存的修改" className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4">
    <p className="text-sm text-amber-100">发现此标签页上次未保存的修改。</p>
    <p className="mt-1 text-xs leading-5 text-slate-300">{changed ? "服务器内容已变化。恢复前请确认，恢复后仍需手动保存。" : "可恢复到编辑区继续调整；暂存内容尚未保存到账号，关闭标签页可能丢失。"}</p>
    <div className="mt-3 flex flex-wrap gap-2"><AppButton onClick={onRestore} variant="primary">恢复修改</AppButton><AppButton onClick={onDiscard} variant="ghost">放弃暂存，使用已保存内容</AppButton></div>
  </section>;
}
