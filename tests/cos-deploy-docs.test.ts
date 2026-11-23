import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("COS deployment documentation", () => {
  const deployGuide = readFileSync("docs/deploy-server.md", "utf8");
  const productionEnv = readFileSync(".env.production.example", "utf8");

  it("documents the COS values that compose passes to the production app", () => {
    expect(productionEnv).toContain("COS_SECRET_ID=");
    expect(productionEnv).toContain("NEXT_PUBLIC_DIRECT_IMAGE_HOSTS=");
    expect(deployGuide).toContain("Optional: Tencent COS cover cache");
    expect(deployGuide).toContain("COS_PUBLIC_BASE_URL");
    expect(deployGuide).toContain("NEXT_PUBLIC_COS_PUBLIC_BASE_URL");
    expect(deployGuide).toContain("pnpm covers:cache-cos");
    expect(deployGuide).toContain("usedPendingAnimeCount: 0");
  });

  it("documents public delivery, CORS, and direct-host boundaries", () => {
    expect(deployGuide).toContain("Allow anonymous `GET` and `HEAD`");
    expect(deployGuide).toContain("CORS rule");
    expect(deployGuide).toContain("NEXT_PUBLIC_DIRECT_IMAGE_HOSTS");
    expect(deployGuide).toContain("/api/image-proxy");
    expect(deployGuide).toContain("embedded while the Next.js image is built");
  });
});
