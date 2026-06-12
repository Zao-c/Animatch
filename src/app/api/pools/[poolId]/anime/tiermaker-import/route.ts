import { badRequest, forbidden, notFound, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { importTierMakerItemsToPool, type TierMakerImportInput } from "@/lib/tiermaker-import";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as TierMakerImportInput | null;

  if (body === null) {
    return badRequest("Invalid JSON body");
  }

  try {
    const user = await getOrCreateDevUser();
    const result = await importTierMakerItemsToPool({
      poolId: context.params.poolId,
      userId: user.id,
      input: body
    });

    return ok(result, { status: result.importedCount > 0 ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TierMaker import failed";

    if (message === "Pool not found") {
      return notFound(message);
    }

    if (message === "Pool does not belong to the current dev user") {
      return forbidden(message);
    }

    if (
      message === "templateUrl is required" ||
      message === "templateUrl must be a valid URL" ||
      message === "items are required" ||
      message === "imageUrl is required" ||
      message === "imageUrl must be a valid URL" ||
      message.includes("items cannot contain more than")
    ) {
      return badRequest(message);
    }

    if (message === "Archived pools cannot import TierMaker items") {
      return badRequest(message);
    }

    return serverError(message);
  }
}
