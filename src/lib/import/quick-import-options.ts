import { AppError } from "@/lib/app-error";
import type { QuickImportParams } from "./quick-pool-builder";

export const MAX_QUICK_IMPORT = 500;
export function validateQuickImportParams(params: QuickImportParams): QuickImportParams {
  if (!params || !["BANGUMI", "MANAMI", "MIXED"].includes(params.source) || !["YEAR", "TAG", "TOP", "USER_COLLECTION"].includes(params.mode)) throw new AppError("请选择有效的导入方式", 400);
  for (const year of [params.year, params.yearFrom, params.yearTo]) {
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > 2100)) throw new AppError("年份需在 1900–2100 之间", 400);
  }
  if (params.mode === "YEAR" && !params.year) throw new AppError("请填写播出年份", 400);
  if (params.limit !== undefined && (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > MAX_QUICK_IMPORT)) throw new AppError(`每次最多查询 ${MAX_QUICK_IMPORT} 部`, 400);
  if (params.tags !== undefined && (!Array.isArray(params.tags) || params.tags.length > 5 || params.tags.some((t) => typeof t !== "string" || !t.trim() || t.length > 50))) throw new AppError("最多选择 5 个标签，每个不超过 50 字", 400);
  if (params.mode === "TAG" && !params.tags?.length) throw new AppError("请至少选择一个题材标签", 400);
  if (params.type && !["ALL", "TV", "MOVIE", "OVA", "ONA", "SPECIAL"].includes(params.type)) throw new AppError("不支持的动画类型", 400);
  if (params.sort && !["rank", "score", "year", "title"].includes(params.sort)) throw new AppError("不支持的排序方式", 400);
  if (params.bangumiUserId !== undefined && (typeof params.bangumiUserId !== "string" || params.bangumiUserId.length > 200)) throw new AppError("Bangumi 用户地址过长", 400);
  if (params.mode === "USER_COLLECTION" && !params.bangumiUserId?.trim()) throw new AppError("请填写 Bangumi 用户名或主页链接", 400);
  return params;
}
