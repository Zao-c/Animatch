import React from "react";
import { AppBadge } from "./ui/AppBadge";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { ErrorAlert } from "./ui/ErrorAlert";

export function TierSharePanel({
  shareError,
  shareUrl,
  shareCopied,
  onCopyShareUrl
}: {
  shareError: string | null;
  shareUrl: string | null;
  shareCopied: boolean;
  onCopyShareUrl: () => void;
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
            <p className="mt-3 break-all text-sm text-slate-300">{shareUrl}</p>
          ) : null}
        </div>
        {shareUrl ? (
          <AppButton onClick={onCopyShareUrl} variant="primary">
            复制链接
          </AppButton>
        ) : null}
      </div>
    </AppCard>
  );
}
