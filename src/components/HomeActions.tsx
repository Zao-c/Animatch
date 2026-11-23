"use client";

import Link from "next/link";
import { appButtonClasses } from "@/components/ui/AppButton";
import { getDashboard } from "@/lib/client-api";

type ContinueAction = {
  href: string;
  label: string;
};

export async function loadHomeContinueAction(
  readDashboard: () => Promise<{
    miniMatchPreview: { source: string; ctaHref?: string; ctaLabel: string };
  }> = getDashboard
): Promise<ContinueAction | null> {
  try {
    const preview = (await readDashboard()).miniMatchPreview;
    return preview.source === "CONTINUE_RUN" && preview.ctaHref
      ? { href: preview.ctaHref, label: preview.ctaLabel }
      : null;
  } catch {
    return null;
  }
}

export function HomeActions() {
  return <nav aria-label="选择对决类型" className="grid w-full max-w-md grid-cols-2 gap-3">
    <Link href="/pools?view=public" className={appButtonClasses({ variant: "primary", size: "lg", className: "min-w-0 px-3 text-center" })}>动画对决</Link>
    <Link href="/anisong" className={appButtonClasses({ variant: "secondary", size: "lg", className: "min-w-0 px-3 text-center" })}>音乐对决</Link>
  </nav>;
}
