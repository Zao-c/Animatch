import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";
import { getCoverDeliveryCandidates } from "../src/lib/image-proxy";

describe("cover delivery candidates", () => {
  it("deduplicates a repeated source without losing COS server fallback", () => {
    const source = "https://bucket.cos.ap-shanghai.myqcloud.com/animatch/covers/a.webp";
    expect(getCoverDeliveryCandidates(source, source, [source])).toEqual([source, `/api/image-proxy?url=${encodeURIComponent(source)}`]);
  });
  it("preserves local uploads and data images without double wrapping", () => {
    expect(getCoverDeliveryCandidates("/uploads/a.webp", "/uploads/a.webp")).toEqual(["/uploads/a.webp"]);
    expect(getCoverDeliveryCandidates("data:image/png;base64,abc")).toEqual(["data:image/png;base64,abc"]);
    expect(getCoverDeliveryCandidates(null)).toEqual([]);
  });
  it("retains fallback sources for exports while deferring network requests until scheduled", () => {
    const html = renderToStaticMarkup(React.createElement(AnimeCover, {src:"/uploads/a.webp",secondarySrc:"/uploads/b.webp",title:"test"}));
    expect(html).toContain('data-cover-primary-src="/uploads/a.webp"');
    expect(html).toContain('data-export-fallback-srcs=');
    expect(html).toContain("/uploads/b.webp");
    expect(html).not.toMatch(/<img[^>]*\ssrc=/);
  });
});
