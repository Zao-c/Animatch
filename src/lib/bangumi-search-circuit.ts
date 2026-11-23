const DEFAULT_MAX_CONCURRENT_SEARCHES = 4;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_CIRCUIT_MS = 30_000;

export const BANGUMI_SEARCH_CIRCUIT_MS = parsePositiveInt(
  process.env.BANGUMI_SEARCH_CIRCUIT_MS,
  DEFAULT_CIRCUIT_MS
);

const maxConcurrentSearches = parsePositiveInt(
  process.env.BANGUMI_SEARCH_MAX_CONCURRENCY,
  DEFAULT_MAX_CONCURRENT_SEARCHES
);
const failureThreshold = parsePositiveInt(
  process.env.BANGUMI_SEARCH_FAILURE_THRESHOLD,
  DEFAULT_FAILURE_THRESHOLD
);

let activeSearches = 0;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

export function canStartBangumiSearch(): boolean {
  return !isBangumiSearchCircuitOpen() && activeSearches < maxConcurrentSearches;
}

export function beginBangumiSearch(): void {
  activeSearches += 1;
}

export function endBangumiSearch(): void {
  activeSearches = Math.max(0, activeSearches - 1);
}

export function isBangumiSearchCircuitOpen(): boolean {
  return circuitOpenUntil > Date.now();
}

export function recordBangumiSearchSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

export function recordBangumiSearchFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= failureThreshold) {
    circuitOpenUntil = Date.now() + BANGUMI_SEARCH_CIRCUIT_MS;
  }
}

export function resetBangumiSearchCircuitForTest(): void {
  activeSearches = 0;
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}
