import { AppError } from "./app-error";
import { BANGUMI_BASE_URL, bangumiRequest, buildHeaders } from "./bangumi";
import { beginBangumiSearch, canStartBangumiSearch, endBangumiSearch, recordBangumiSearchFailure, recordBangumiSearchSuccess } from "./bangumi-search-circuit";
import type { NomineeReference } from "./award-nominations";
import type { ReferenceCard, ReferenceDetail } from "./award-reference-types";

const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
async function request(path: string, body?: object): Promise<unknown> {
  const key = path + JSON.stringify(body ?? null), hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const flight = pending.get(key);
  if (flight) return flight;
  if (!canStartBangumiSearch()) throw new AppError("Bangumi 查询繁忙，请稍后重试；仍可复用群友候选或手动填写。", 503);
  beginBangumiSearch();
  const task = (async () => {
    try {
      const response = await bangumiRequest(`${BANGUMI_BASE_URL}${path}`, { method: body ? "POST" : "GET", headers: buildHeaders(body ? { "Content-Type": "application/json" } : {}), ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new AppError(response.statusCode === 404 ? "Bangumi 暂无这条资料" : "Bangumi 资料暂时不可用，请稍后重试", response.statusCode === 404 ? 404 : 502);
      const value = await response.json();
      recordBangumiSearchSuccess();
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 300_000, value });
      return value;
    } catch (e) {
      if (!(e instanceof AppError && e.statusCode === 404)) recordBangumiSearchFailure();
      throw e instanceof AppError ? e : new AppError("Bangumi 连接暂时不可用，可稍后重试或前往资料页查看", 502);
    } finally { endBangumiSearch(); pending.delete(key); }
  })();
  pending.set(key, task);
  return task;
}
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown, max = 500): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export function normalizeReferenceCard(raw: unknown, kind: NomineeReference["kind"]): ReferenceCard | null {
  const item = obj(raw), id = Number(item.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !str(item.name)) return null;
  let chineseName = str(item.name_cn, 150);
  const aliases: string[] = [];
  for (const rawInfo of list(item.infobox)) {
    const info = obj(rawInfo);
    if (info.key === "简体中文名") chineseName ||= str(info.value, 150);
    if (info.key === "别名") {
      if (typeof info.value === "string") aliases.push(str(info.value, 150));
      else for (const alias of list(info.value)) aliases.push(str(obj(alias).v ?? obj(alias).value, 150));
    }
  }
  const title = chineseName || str(item.name, 150);
  return { reference: { kind, id }, title, subtitle: title === item.name ? "" : str(item.name, 150), aliases: [...new Set(aliases.filter(Boolean))].slice(0, 12),
    summary: str(item.summary, 1800), role: str(item.relation, 150) };
}
export function referenceKind(value: string | null): NomineeReference["kind"] {
  if (value !== "subject" && value !== "person" && value !== "character") throw new AppError("请选择作品、制作人员或角色", 400);
  return value;
}
export function referenceId(value: string | null): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) throw new AppError("资料编号无效", 400);
  return id;
}
export async function searchAwardReferences(query: string, kind: NomineeReference["kind"], music = false): Promise<ReferenceCard[]> {
  const keyword = query.trim();
  if (keyword.length < 2 || keyword.length > 100) throw new AppError("请输入 2–100 字的名称", 400);
  const response = obj(await request(`/search/${kind}s?limit=8&offset=0`, { keyword, ...(kind === "subject" ? { filter: { type: [music ? 3 : 2] } } : {}) }));
  return list(response.data).map((item) => normalizeReferenceCard(item, kind)).filter((item): item is ReferenceCard => item !== null);
}
export async function getAwardReference(kind: NomineeReference["kind"], id: number): Promise<ReferenceDetail> {
  const card = normalizeReferenceCard(await request(`/${kind}s/${id}`), kind);
  if (!card) throw new AppError("资料格式暂时不可用", 502);
  if (kind === "subject") return { card, works: [], worksUnavailable: false };
  try {
    const rows = list(await request(`/${kind}s/${id}/subjects`));
    const works = new Map<number, { id: number; title: string; role: string }>();
    for (const row of rows) {
      const item = obj(row), workId = Number(item.id);
      if (Number(item.type) !== 2 || !Number.isSafeInteger(workId) || workId <= 0) continue;
      const role = str(item.staff ?? item.relation, 150), previous = works.get(workId);
      works.set(workId, { id: workId, title: str(item.name_cn, 150) || str(item.name, 150), role: [...new Set([...(previous?.role.split(" / ") ?? []), role].filter(Boolean))].join(" / ") });
    }
    return { card, works: [...works.values()].slice(0, 120), worksUnavailable: false };
  } catch { return { card, works: [], worksUnavailable: true }; }
}
export async function getAwardCredits(id: number, kind: "person" | "character"): Promise<ReferenceCard[]> {
  const rows = list(await request(`/subjects/${id}/${kind}s`));
  const credits = new Map<number, ReferenceCard>();
  for (const raw of rows) {
    const card = normalizeReferenceCard(raw, kind);
    if (!card) continue;
    const previous = credits.get(card.reference.id);
    card.role = [...new Set([...(previous?.role.split(" / ") ?? []), card.role].filter(Boolean))].join(" / ");
    credits.set(card.reference.id, card);
  }
  return [...credits.values()].slice(0, 250);
}
