export const TIER_KEYS = ["S", "A", "B", "C", "D"] as const;
export type TierKey = (typeof TIER_KEYS)[number];
export type TierLabels = Record<string, string>;

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

export function normalizeTierLabels(labels: Partial<Record<string, string>>): TierLabels {
  const result: TierLabels = { ...DEFAULT_TIER_LABELS };
  for (const key of Object.keys(labels)) {
    const normalized = normalizeTierLabelInput(labels[key] ?? "");
    result[key] = normalized.length > 0 ? normalized : (DEFAULT_TIER_LABELS[key] ?? key);
  }
  return result;
}

export function readTierLabels(
  poolId: string,
  runId: string,
  storage = getBrowserStorage()
): TierLabels {
  if (storage === null) {
    return { ...DEFAULT_TIER_LABELS };
  }

  try {
    const raw = storage.getItem(getTierLabelStorageKey(poolId, runId));
    if (raw === null) {
      return { ...DEFAULT_TIER_LABELS };
    }

    return normalizeTierLabels(JSON.parse(raw) as Partial<Record<string, string>>);
  } catch {
    return { ...DEFAULT_TIER_LABELS };
  }
}

export function saveTierLabels(
  poolId: string,
  runId: string,
  labels: Partial<Record<string, string>>,
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
      return { ...DEFAULT_TIER_LABELS };
    }
  }

  return { ...DEFAULT_TIER_LABELS };
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}
