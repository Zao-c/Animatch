import { describe, expect, it } from "vitest";
import {
  buildTierExportFilename,
  formatTierExportTimestamp,
  sanitizeFilenameSegment
} from "../src/lib/tier-export";

describe("tier export helpers", () => {
  it("sanitizes pool names for download filenames", () => {
    expect(sanitizeFilenameSegment(' 我的/番组:*?"<>|  ')).toBe("我的-番组");
  });

  it("falls back when the sanitized filename is empty", () => {
    expect(sanitizeFilenameSegment("///")).toBe("tier-list");
  });

  it("formats local export timestamps", () => {
    expect(formatTierExportTimestamp(new Date(2026, 5, 11, 9, 5))).toBe("20260611-0905");
  });

  it("builds deterministic tier export filenames", () => {
    expect(buildTierExportFilename("Test Pool", new Date(2026, 5, 11, 22, 30))).toBe(
      "animatch-tier-Test-Pool-20260611-2230.png"
    );
  });
});
