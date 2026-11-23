import { AppError } from "@/lib/app-error";
const requests = new Map<string, { count: number; until: number }>();
export function limitNetease(userId: string, scope: string, maximum = 60) {
  const now = Date.now();
  for (const [key, value] of requests) if (value.until <= now) requests.delete(key);
  const key = `${userId}:${scope}`;
  const entry = requests.get(key) ?? { count: 0, until: now + 60000 };
  if (entry.count >= maximum || (!requests.has(key) && requests.size >= 4096)) throw new AppError("操作过于频繁，请一分钟后再试", 429);
  entry.count++; requests.set(key, entry);
}
