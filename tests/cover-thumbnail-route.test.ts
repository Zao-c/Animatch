import { describe, expect, it } from "vitest";
import { GET } from "../src/app/api/cover-thumbnail/route";

describe("cover-thumbnail GET", () => {
  it("rejects unsupported variants before loading any image", async () => {
    const response = await GET(new Request("http://localhost/api/cover-thumbnail?variant=bad&src=x"));
    expect(response.status).toBe(400);
  });

  it("rejects file traversal and private local paths", async () => {
    const urls = [
      "/api/cover-thumbnail?variant=card&src=%2Fuploads%2Fcustom-items%2F..%2Fsecret.png",
      "/api/cover-thumbnail?variant=tier&src=%2Fetc%2Fpasswd",
      "/api/cover-thumbnail?variant=tier&src=file%3A%2F%2F%2Fetc%2Fpasswd"
    ];
    for (const path of urls) {
      const response = await GET(new Request("http://localhost" + path));
      expect(response.status).toBe(400);
    }
  });
});
