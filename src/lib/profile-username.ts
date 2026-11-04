/** Next's client-side route params retain percent escapes for non-ASCII paths. */
export function decodeProfileUsername(username: string): string {
  try {
    return decodeURIComponent(username);
  } catch {
    return username;
  }
}

/** Profiles are addressed by username, which may contain Chinese, spaces or symbols. */
export function profilePath(username: string): string {
  return "/u/" + encodeURIComponent(username);
}
