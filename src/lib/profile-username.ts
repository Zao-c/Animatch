/** Next's client-side route params retain percent escapes for non-ASCII paths. */
export function decodeProfileUsername(username: string): string {
  try {
    return decodeURIComponent(username);
  } catch {
    return username;
  }
}
