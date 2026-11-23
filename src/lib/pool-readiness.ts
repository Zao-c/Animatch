export type ReadinessStatus = "ready" | "needs_work" | "blocked";

export interface ReadinessIssue {
  kind: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface PoolReadinessReport {
  status: ReadinessStatus;
  activeCount: number;
  missingCoverCount: number;
  suspiciousTitleCount: number;
  sourceTypeCounts: Record<string, number>;
  issues: ReadinessIssue[];
  suggestions: string[];
}

export interface PoolReadinessInput {
  animeCount: number;
  hasTitle: boolean;
  hasDescription: boolean;
  visibility: string | null;
  animeSourceFields: AnimeSourceField[];
}

export interface AnimeSourceField {
  source: string | null;
  title: string | null;
  titleCn: string | null;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  imageLargeUrl: string | null;
  thumbnailUrl: string | null;
}

const DIRTY_TITLE_PATTERNS = [
  /^未命名/,
  /^untitled$/i,
  /^unknown$/i,
  /^image[_\-\s]?\d+$/i,
  /^img[_\-\s]?\d+$/i,
  /^zzz/i,
  /^\d{15,}$/
];

const SUSPICIOUS_TITLE_SOURCES = new Set([
  "TIERMAKER_IMPORT",
  "CUSTOM_UPLOAD"
]);

export function buildPoolReadinessReport(input: PoolReadinessInput): PoolReadinessReport {
  const issues: ReadinessIssue[] = [];
  const suggestions: string[] = [];

  let missingCoverCount = 0;
  let suspiciousTitleCount = 0;
  const sourceTypeCounts: Record<string, number> = {};

  for (const a of input.animeSourceFields) {
    const source = a.source ?? "UNKNOWN";
    sourceTypeCounts[source] = (sourceTypeCounts[source] ?? 0) + 1;

    const hasCover =
      a.imageUrl !== null ||
      a.imageMediumUrl !== null ||
      a.imageLargeUrl !== null ||
      a.thumbnailUrl !== null;

    if (!hasCover) {
      missingCoverCount += 1;
    }

    const effectiveTitle = a.titleCn ?? a.title ?? "";
    if (!hasSuspectTitle(effectiveTitle, a.source)) {
      continue;
    }

    suspiciousTitleCount += 1;
  }

  if (missingCoverCount > 0) {
    issues.push({
      kind: "missing_cover",
      message: `有 ${missingCoverCount} 个作品缺少封面`,
      severity: "warning"
    });
  }

  if (suspiciousTitleCount > 0) {
    issues.push({
      kind: "suspicious_title",
      message: `有 ${suspiciousTitleCount} 个作品名称可能需要清理`,
      severity: "warning"
    });
    suggestions.push("检查 TierMaker 导入和自定义上传的作品名称，将其修改为规范名称。");
  }

  if (input.animeCount < 2) {
    issues.push({
      kind: "too_few_anime",
      message: "作品数不足 2，无法进行对决",
      severity: "error"
    });
    suggestions.push("至少添加 2 个作品才能开始对决。");
  }

  if (input.animeCount < 8) {
    issues.push({
      kind: "few_anime",
      message: "作品数偏少，建议继续导入",
      severity: "warning"
    });
    suggestions.push("建议至少 8 个作品，才能形成有区分度的个人榜单和分享图。");
  }

  if (suspiciousTitleCount > 0 || missingCoverCount > 0) {
    suggestions.push("打开作品墙的「批量管理」可以快速定位并清理问题作品。");
  }

  if (!input.hasTitle) {
    issues.push({
      kind: "no_title",
      message: "番组名称未设置",
      severity: "warning"
    });
    suggestions.push("在「番组设置」中填写番组名称。");
  }

  if (!input.hasDescription) {
    issues.push({
      kind: "no_description",
      message: "番组说明未填写",
      severity: "info"
    });
  }

  let status: ReadinessStatus;

  const hasBlockingError = issues.some((i) => i.severity === "error");
  if (hasBlockingError) {
    status = "blocked";
  } else if (missingCoverCount > 0 || suspiciousTitleCount > 0 || !input.hasTitle || input.animeCount < 8) {
    status = "needs_work";
  } else {
    status = "ready";
  }

  return {
    status,
    activeCount: input.animeCount,
    missingCoverCount,
    suspiciousTitleCount,
    sourceTypeCounts,
    issues,
    suggestions
  };
}

function hasSuspectTitle(title: string, source: string | null): boolean {
  if (title.length === 0) {
    return false;
  }

  for (const pattern of DIRTY_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return true;
    }
  }

  if (source !== null && SUSPICIOUS_TITLE_SOURCES.has(source) && title.length > 25) {
    return true;
  }

  return false;
}

export function getReadinessStatusLabel(status: ReadinessStatus): string {
  switch (status) {
    case "ready":
      return "适合公开";
    case "needs_work":
      return "建议完善";
    case "blocked":
      return "暂不适合公开";
  }
}
