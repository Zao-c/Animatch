import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tier export privacy", () => {
  const source = readFileSync("src/app/pools/[poolId]/runs/[runId]/tier/page.tsx", "utf8");

  it("exports images from a local snapshot without creating a public share token", () => {
    const exportBody = source.slice(
      source.indexOf("async function handleExportImage()"),
      source.indexOf("async function handleCreateShare()")
    );

    expect(source).toContain("function buildLocalTierExportShare");
    expect(exportBody).toContain("buildLocalTierExportShare");
    expect(exportBody).toContain("setShareSnapshot(share)");
    expect(exportBody).toContain("exportShareCardAsPng");
    expect(exportBody).not.toContain("createTierShare");
    expect(exportBody).not.toContain("setShareUrl");
  });

  it("keeps public sharing explicit behind the share action", () => {
    const shareBody = source.slice(
      source.indexOf("async function handleCreateShare()"),
      source.indexOf("async function handleCopyShareUrl()")
    );

    expect(shareBody).toContain("createTierShare");
    expect(shareBody).toContain("setShareUrl");
  });
});
