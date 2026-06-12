const SHANGHAI_OFFSET_MINUTES = 8 * 60;

export function formatDateTimeStable(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MINUTES * 60 * 1000);

  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate())
  ].join("-") + ` ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
