import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "../src/lib/safe-redirect";

describe("sanitizeNextPath", () => {
  it.each([
    ["/pools", "/pools"],
    ["/pools?x=1#y", "/pools?x=1#y"],
    ["/pools/abc?x=1", "/pools/abc?x=1"],
    ["/pools/abc#add-anime", "/pools/abc#add-anime"]
  ])("allows safe local path %s", (input, expected) => {
    expect(sanitizeNextPath(input)).toBe(expected);
  });

  it.each([
    ["//evil.com"],
    ["https://evil.com"],
    ["http://evil.com"],
    ["javascript:alert(1)"],
    ["data:text/html,xxx"],
    ["abc"],
    [""],
    [null],
    [undefined],
    ["/\\evil"],
    ["\\evil"]
  ])("rejects unsafe next path %s", (input) => {
    expect(sanitizeNextPath(input)).toBe("/");
  });
});
