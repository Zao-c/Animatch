import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pools search draft and URL synchronization", () => {
  const source = readFileSync("src/app/pools/page.tsx", "utf8");
  const sync = source.slice(
    source.indexOf("const lastUrlQueryRef = useRef("),
    source.indexOf("function updateListParams(")
  );

  it("preserves an unsubmitted search draft across view, filter, and sort changes", () => {
    expect(sync).toContain('const lastUrlQueryRef = useRef(searchParams.get("q") ?? "")');
    expect(sync).toContain('const urlQuery = searchParams.get("q") ?? ""');
    expect(sync).toMatch(
      /if \(urlQuery !== lastUrlQueryRef\.current\) \{\s*lastUrlQueryRef\.current = urlQuery;\s*setQuery\(urlQuery\);\s*\}/
    );
    expect(sync).not.toContain('setQuery(searchParams.get("q") ?? "")');
  });

  it("updates search state when the URL search term actually changes", () => {
    expect(sync).toContain("setAppliedQuery(urlQuery.trim())");
    expect(sync).toContain('setView(parsePoolView(searchParams.get("view")))');
    expect(sync).toContain('setFilter(parsePoolFilter(searchParams.get("status")))');
    expect(sync).toContain('setSort(parsePoolSort(searchParams.get("sort")))');
  });

  it("keeps deliberate search submission and explicit clear working", () => {
    expect(source).toContain("function handleSearch(event: FormEvent<HTMLFormElement>)");
    expect(source).toContain("updateListParams({ q: nextQuery || undefined })");
    expect(source).toContain('updateListParams({ q: undefined, status: undefined })');
    expect(source).toContain('const nextParams = new URLSearchParams(searchParams.toString())');
    expect(source).toContain('setQuery("")');
  });
});
