import { badRequest, ok, serverError } from "@/lib/api-response";
import { importBangumiSubjects, toPublicAnime } from "@/lib/anime-service";

interface BulkImportBody {
  input?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BulkImportBody | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return badRequest("input is required");
  }

  try {
    const result = await importBangumiSubjects(input);

    return ok({
      imported: result.imported.map(toPublicAnime),
      failed: result.failed
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Bulk import failed");
  }
}
