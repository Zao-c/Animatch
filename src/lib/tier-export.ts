export function sanitizeFilenameSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized.slice(0, 80) : "tier-list";
}

export function formatTierExportTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}${month}${day}-${hours}${minutes}`;
}

export function buildTierExportFilename(poolName: string, date = new Date()): string {
  return `animatch-tier-${sanitizeFilenameSegment(poolName)}-${formatTierExportTimestamp(date)}.png`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
