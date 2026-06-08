import { describe, expect, it } from "vitest";
import { badRequest, forbidden, notFound, ok, serverError } from "../src/lib/api-response";

describe("api-response", () => {
  it("returns standard success payloads", async () => {
    const response = ok({ id: "anime-1" }, { status: 201 });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        id: "anime-1"
      }
    });
    expect(response.status).toBe(201);
  });

  it("returns bad request errors", async () => {
    const response = badRequest("q is required");

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        message: "q is required"
      }
    });
    expect(response.status).toBe(400);
  });

  it("returns common error status codes", () => {
    expect(notFound("missing").status).toBe(404);
    expect(forbidden("denied").status).toBe(403);
    expect(serverError("failed").status).toBe(500);
  });
});
