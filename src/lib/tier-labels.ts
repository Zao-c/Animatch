export const TIER_KEYS = ["S", "A", "B", "C", "D"] as const;
export type TierKey = (typeof TIER_KEYS)[number];
export type TierLabels = Record<TierKey, string>;

export const DEFAULT_TIER_LABELS: TierLabels = {
  S: "S",
  A: "A",
  B: "B",
  C: "C",
  D: "D"
};

const MAX_LABEL_UNITS = 16;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function getTierLabelStorageKey(poolId: string, runId: string): string {
  return `animatch:tier-labels:${poolId}:${runId}`;
}

export function normalizeTierLabelInput(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  let units = 0;
  let result = "";

  for (const char of normalized) {
    const charUnits = char.charCodeAt(0) > 127 ? 2 : 1;
    if (units + charUnits > MAX_LABEL_UNITS) {
      break;
    }
    units += charUnits;
    result += char;
  }

  return result;
}

export function normalizeTierLabels(labels: Partial<Record<TierKey, string>>): TierLabels {
  return {
    S: normalizeOrDefault("S", labels.S),
    A: normalizeOrDefault("A", labels.A),
    B: normalizeOrDefault("B", labels.B),
    C: normalizeOrDefault("C", labels.C),
    D: normalizeOrDefault("D", labels.D)
  };
}

export function readTierLabels(
  poolId: string,
  runId: string,
  storage = getBrowserStorage()
): TierLabels {
  if (storage === null) {
    return DEFAULT_TIER_LABELS;
  }

  try {
    const raw = storage.getItem(getTierLabelStorageKey(poolId, runId));
    if (raw === null) {
      return DEFAULT_TIER_LABELS;
    }

    return normalizeTierLabels(JSON.parse(raw) as Partial<Record<TierKey, string>>);
  } catch {
    return DEFAULT_TIER_LABELS;
  }
}

export function saveTierLabels(
  poolId: string,
  runId: string,
  labels: Partial<Record<TierKey, string>>,
  storage = getBrowserStorage()
): TierLabels {
  const normalized = normalizeTierLabels(labels);

  if (storage !== null) {
    try {
      storage.setItem(getTierLabelStorageKey(poolId, runId), JSON.stringify(normalized));
    } catch {
      return normalized;
    }
  }

  return normalized;
}

export function resetTierLabels(
  poolId: string,
  runId: string,
  storage = getBrowserStorage()
): TierLabels {
  if (storage !== null) {
    try {
      storage.removeItem(getTierLabelStorageKey(poolId, runId));
    } catch {
      return DEFAULT_TIER_LABELS;
    }
  }

  return DEFAULT_TIER_LABELS;
}

function normalizeOrDefault(tier: TierKey, value: string | undefined): string {
  const normalized = normalizeTierLabelInput(value ?? "");
  return normalized.length > 0 ? normalized : DEFAULT_TIER_LABELS[tier];
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
