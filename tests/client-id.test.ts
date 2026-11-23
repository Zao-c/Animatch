import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientMutationId } from "../src/lib/client-id";

describe("createClientMutationId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses randomUUID when available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111"
    });

    expect(createClientMutationId("comparison")).toBe(
      "comparison-11111111-1111-4111-8111-111111111111"
    );
  });

  it("uses getRandomValues when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        return bytes;
      }
    });

    expect(createClientMutationId("comparison")).toBe(
      "comparison-00010203-0405-4607-8809-0a0b0c0d0e0f"
    );
  });

  it("falls back when crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(1_782_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    expect(createClientMutationId("comparison")).toMatch(/^comparison-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("returns different ids on consecutive calls", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
        .mockReturnValueOnce("22222222-2222-4222-8222-222222222222")
    });

    const first = createClientMutationId("comparison");
    const second = createClientMutationId("comparison");

    expect(first).not.toBe(second);
  });
});
