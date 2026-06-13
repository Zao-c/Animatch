const SAFE_REDIRECT_ORIGIN = "http://animatch.local";

export function sanitizeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") {
    return "/";
  }

  const value = input.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const url = new URL(value, SAFE_REDIRECT_ORIGIN);
    if (url.origin !== SAFE_REDIRECT_ORIGIN) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}
