import { beforeEach,describe,expect,it,vi } from "vitest";
import { preloadPairs } from "../src/lib/preload-images";
import { loadCoverImage } from "../src/lib/cover-loader";
vi.mock("../src/lib/cover-loader",()=>({loadCoverImage:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();vi.mocked(loadCoverImage).mockResolvedValue("/loaded");});
describe("preload source coverage",()=>{
  it("warms both the COS and original-source routes with lower priority",async()=>{
    const cos="https://bucket.cos.ap-shanghai.myqcloud.com/animatch/covers/preload.webp", original="https://lain.bgm.tv/pic/cover/l/preload.jpg";
    const anime={cachedCoverUrl:cos,imageLargeUrl:original};
    expect(await preloadPairs([{left:anime,right:anime}] as any)).toEqual({loaded:2,total:2});
    const [sources,options]=vi.mocked(loadCoverImage).mock.calls[0];
    expect(sources).toContain(cos);expect(sources).toContain(`/api/image-proxy?url=${encodeURIComponent(cos)}`);expect(sources).toContain(`/api/image-proxy?url=${encodeURIComponent(original)}`);
    expect(options.priority).toBe(2);
  });
  it("preloads the same 2:3 smart derivative as the visible Match card",async()=>{
    const anime={source:"TIERMAKER_IMPORT",imageUrl:"/uploads/custom-items/duel.png"};
    expect(await preloadPairs([{left:anime,right:anime}] as any)).toEqual({loaded:2,total:2});
    const [sources]=vi.mocked(loadCoverImage).mock.calls[0];
    expect(sources[0]).toBe("/api/cover-thumbnail?variant=card&src=%2Fuploads%2Fcustom-items%2Fduel.png");
    expect(sources).toContain("/uploads/custom-items/duel.png");
  });
  it("does not require all preloads to succeed",async()=>{
    vi.mocked(loadCoverImage).mockRejectedValueOnce(new Error("unavailable"));
    expect(await preloadPairs([{left:{imageUrl:"/a"},right:{imageUrl:"/b"}}] as any)).toEqual({loaded:1,total:2});
  });
});
