import { describe, it, expect } from "vitest";
import { GET } from "../src/app/api/image-proxy/route";

describe("image proxy API SSRF protection", () => {
  it("rejects missing url parameter", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy")
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("url is required");
  });

  it("rejects invalid url", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=not-a-url")
    );
    expect(response.status).toBe(400);
  });

  it("rejects file protocol", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=file:///etc/passwd")
    );
    expect(response.status).toBe(400);
  });

  it("rejects localhost", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://localhost:3000/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 127.0.0.1", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://127.0.0.1:3000/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 0.0.0.0", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://0.0.0.0:3000/")
    );
    expect(response.status).toBe(400);
  });

  it("rejects internal 10.x IP", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://10.0.0.1/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects internal 192.168.x IP", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://192.168.1.1/secret")
    );
    expect(response.status).toBe(400);
  });

  it("rejects 172.16-31.x IP range", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://172.16.0.1/secret")
    );
    expect(response.status).toBe(400);
    const response2 = await GET(
      new Request("http://localhost:3000/api/image-proxy?url=http://172.31.255.255/secret")
    );
    expect(response2.status).toBe(400);
  });
});
