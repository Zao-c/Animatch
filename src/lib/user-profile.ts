/** Public profile collections are paginated server-side; the route module itself may
 * only export HTTP handlers, so the shared shape lives here. */
export const PROFILE_PAGE_SIZE = 9;

export const PROFILE_SECTIONS = ["pools", "tiers", "songs", "songTiers"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** The client tabs use "shares" for animation tier lists, the API calls the same
 * collection "tiers". Accept both and stay tolerant of anything unknown. */
export function resolveProfileSection(value: string | null | undefined): ProfileSection {
  const requested = value === "shares" ? "tiers" : value;
  return requested === "tiers" || requested === "songs" || requested === "songTiers"
    ? requested
    : "pools";
}

export function resolveProfilePage(value: string | null | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(10000, parsed) : 1;
}

export function profilePageCount(total: number, pageSize = PROFILE_PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Tabs as the profile page names them; "shares" is the animation Tier List tab. */
export type ProfileTab = "pools" | "shares" | "songs" | "songTiers";

/** One request per tab/page: the section and page travel together so a slow
 * response can never be applied to a different tab. */
export function profileCollectionUrl(username: string, tab: ProfileTab, page: number): string {
  return "/api/users/" + encodeURIComponent(username) + "/public-profile?section=" + tab + "&page=" + resolveProfilePage(String(page));
}
