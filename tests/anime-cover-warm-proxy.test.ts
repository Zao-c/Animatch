import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimeCover } from "../src/components/AnimeCover";
afterEach(()=>vi.unstubAllGlobals());
describe("cover request scheduling",()=>{
  it("does not issue extra warm fetches or unscheduled image loads during rendering",()=>{
    const image=vi.fn(), fetch=vi.fn(); vi.stubGlobal("Image",image); vi.stubGlobal("fetch",fetch);
    const html=renderToStaticMarkup(React.createElement(AnimeCover,{src:"/uploads/queued.webp",title:"queued",warm:true,loading:"eager"}));
    expect(image).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
    expect(html).not.toMatch(/<img[^>]*\ssrc=/);
    expect(html).toContain('data-export-src="/uploads/queued.webp"');
  });
  it("retains image fit and title placeholders before an offscreen image begins",()=>{
    const html=renderToStaticMarkup(React.createElement(AnimeCover,{src:"/uploads/offscreen.webp",title:"offscreen",fit:"contain"}));
    expect(html).toContain('loading="lazy"');expect(html).toContain("object-contain");expect(html).toContain('alt="offscreen"');
  });
});
