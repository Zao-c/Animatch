import React from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { ErrorAlert } from "./ui/ErrorAlert";

export function TierSharePanel({
  shareError,
  shareUrl,
  shareCopied,
  shareCopyFallback = false,
  onCopyShareUrl,
  createdAt,
  isOutdated = false,
  onCreateNewShare,
  disabled = false
}: {
  shareError: string | null;
  shareUrl: string | null;
  shareCopied: boolean;
  shareCopyFallback?: boolean;
  onCopyShareUrl: () => void;
  createdAt?: string | null;
  isOutdated?: boolean;
  onCreateNewShare?: () => void;
  disabled?: boolean;
}) {
  if (shareError === null && shareUrl === null) {
    return null;
  }

  return (
    <AppCard className="mb-5 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <AppBadge tone="source">
            {shareUrl ? (shareCopied ? "分享链接已复制" : "分享链接已生成") : "分享链接"}
          </AppBadge>
          {shareError ? (
            <ErrorAlert message={shareError} className="mt-3" />
          ) : null}
          {shareUrl ? (
          <div>
            {createdAt ? <p className="mt-3 text-xs text-slate-400">快照生成时间：<time dateTime={createdAt}>{new Date(createdAt).toLocaleString("zh-CN")}</time></p> : null}
            <p className={`mt-2 text-xs leading-5 ${isOutdated ? "text-amber-200" : "text-slate-400"}`} role={isOutdated ? "status" : undefined}>
              {isOutdated ? "当前榜单有后续调整，此链接仍保留生成时的内容。需要分享新排序时，请重新生成链接。" : "这是固定快照，之后的编辑不会更新这个链接。"}
            </p>
            <p className="mt-3 break-all text-sm text-slate-300">{shareUrl}</p>
            {shareCopyFallback ? (
              <div className="mt-3">
                <p className="text-xs text-red-300">自动复制失败，请手动复制上面的链接。</p>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="anime-field mt-2 w-full text-xs"
                  onFocus={(e) => {
                    e.target.select();
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
        {shareUrl ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <AppButton id="tier-share-copy" onClick={onCopyShareUrl} variant={isOutdated ? "secondary" : "primary"}>
              {isOutdated ? "复制之前的链接" : "复制链接"}
            </AppButton>
            {isOutdated && onCreateNewShare ? <AppButton onClick={onCreateNewShare} disabled={disabled} variant="primary">按当前榜单重新生成</AppButton> : null}
          </div>
        ) : null}
      </div>
    </AppCard>
  );
}
