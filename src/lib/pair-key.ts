export function makePairKey(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();

  if (!left || !right) {
    throw new Error("Both anime ids are required");
  }

  return [left, right].sort().join(":");
}
