export const WATCH_STATUSES = [
  "UNKNOWN",
  "UNSEEN",
  "WATCHING",
  "WATCHED",
  "DROPPED",
  "INTERESTED",
  "NOT_INTERESTED"
] as const;

export type WatchStatus = (typeof WATCH_STATUSES)[number];

export function isWatchStatus(value: string): value is WatchStatus {
  return WATCH_STATUSES.includes(value as WatchStatus);
}
