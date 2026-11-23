import { describe, expect, it } from "vitest";
import { decodeProfileUsername } from "../src/lib/profile-username";

describe("profile username path parameter", () => {
  it("decodes a Chinese username before it is used in API paths", () => {
    const username = decodeProfileUsername("%E9%BA%BB%E9%9B%80");
    expect(username).toBe("麻雀");
    expect(encodeURIComponent(username)).toBe("%E9%BA%BB%E9%9B%80");
  });

  it("accepts a parameter already decoded by the router", () => {
    expect(decodeProfileUsername("麻雀")).toBe("麻雀");
  });

  it("does not crash on a malformed escape", () => {
    expect(decodeProfileUsername("bad%name")).toBe("bad%name");
  });
});
