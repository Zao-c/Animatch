"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { copyToClipboard } from "@/lib/clipboard";

const FEEDBACK_TYPES = [
  { key: "where-next", label: "不知道下一步点哪里" },
  { key: "page-error", label: "页面/按钮出错" },
  { key: "image-cover", label: "图片或封面问题" },
  { key: "duel-experience", label: "对决体验问题" },
  { key: "tier-result", label: "Tier 榜单结果问题" },
  { key: "copy-confusing", label: "文案看不懂" },
  { key: "other", label: "其他" }
] as const;

type FeedbackTypeKey = (typeof FEEDBACK_TYPES)[number]["key"];

export function formatFeedbackText(input: {
  type: FeedbackTypeKey;
  content: string;
  name: string;
  pathname: string;
}): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const typeLabel =
    FEEDBACK_TYPES.find((t) => t.key === input.type)?.label ?? input.type;

  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";

  return [
    "【AniMatch 试玩反馈】",
    `时间：${timeStr}`,
    `页面：${input.pathname}`,
    `类型：${typeLabel}`,
    "反馈：",
    input.content,
    "",
    "备注：",
    input.name || "（未填写）",
    "",
    "浏览器：",
    ua
  ].join("\n");
}

export function PlaytestFeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackTypeKey>("other");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copied" | "manual"
  >("idle");

  const manualTextareaRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = useCallback(() => {
    setType("other");
    setContent("");
    setName("");
    setCopyStatus("idle");
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (copyStatus === "manual" && manualTextareaRef.current) {
      manualTextareaRef.current.select();
    }
  }, [copyStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const handleCopy = useCallback(async () => {
    const text = formatFeedbackText({
      type,
      content,
      name,
      pathname
    });

    const result = await copyToClipboard(text);
    if (result.ok) {
      setCopyStatus("copied");
    } else {
      setCopyStatus("manual");
    }
  }, [type, content, name, pathname]);

  const handleOpen = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="反馈试玩体验"
        className="fixed bottom-4 right-4 z-30 flex h-11 min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-400 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-anime hover:border-anime-purple/35 hover:text-purple-200 hover:shadow-[0_12px_40px_rgba(167,139,250,0.12)] active:scale-[0.97] sm:gap-2 sm:px-4 sm:text-sm"
      >
        <svg
          className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.8"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
          />
        </svg>
        <span className="hidden sm:inline">反馈</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <AppCard
            variant="modal"
            className="relative z-10 mx-0 w-full max-h-[90dvh] overflow-y-auto rounded-b-none rounded-t-anime-lg sm:mx-4 sm:max-w-lg sm:rounded-anime-lg"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-anime-panel px-5 py-3.5">
              <h2 className="text-base font-semibold text-white">
                反馈试玩体验
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition duration-anime hover:bg-white/[0.08] hover:text-white"
                aria-label="关闭"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-slate-300">
                  反馈类型
                </legend>
                <div className="flex flex-wrap gap-2">
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.key}
                      type="button"
                      onClick={() => setType(ft.key)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition duration-anime",
                        type === ft.key
                          ? "border-anime-purple/50 bg-anime-purple/15 text-purple-100"
                          : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200"
                      ].join(" ")}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  反馈内容
                </span>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="描述你遇到的问题或感受…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-anime-purple/40 focus:outline-none focus:ring-1 focus:ring-anime-purple/20"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  你的称呼
                  <span className="ml-1 text-xs text-slate-500">（可选）</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="方便站长知道是谁反馈"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-anime-purple/40 focus:outline-none focus:ring-1 focus:ring-anime-purple/20"
                />
              </label>

              {copyStatus === "manual" && (
                <div>
                  <p className="mb-2 text-sm text-amber-300">
                    自动复制失败，请手动复制下方文本。
                  </p>
                  <textarea
                    ref={manualTextareaRef}
                    readOnly
                    rows={10}
                    value={formatFeedbackText({
                      type,
                      content,
                      name,
                      pathname
                    })}
                    className="w-full resize-none rounded-xl border border-amber-400/30 bg-amber-400/[0.04] px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {copyStatus === "copied" && (
                <p className="rounded-xl border border-anime-cyan/30 bg-anime-cyan/8 px-3.5 py-2.5 text-sm text-cyan-200">
                  已复制，可以直接发给站长。
                </p>
              )}

              {content.trim().length === 0 && copyStatus === "idle" && (
                <p className="text-xs text-slate-500">
                  可以补充几句话，也可以直接复制页面信息。
                </p>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-anime-panel px-5 py-3.5">
              <AppButton variant="ghost" size="sm" onClick={handleClose}>
                关闭
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                onClick={handleCopy}
                disabled={copyStatus === "manual"}
              >
                {copyStatus === "copied" ? "已复制" : "复制反馈"}
              </AppButton>
            </div>
          </AppCard>
        </div>
      )}
    </>
  );
}
