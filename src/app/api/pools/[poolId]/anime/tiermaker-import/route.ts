import { badRequest, forbidden, notFound, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import {
  importTierMakerItemsToPool,
  importTierMakerFromUrl,
  type TierMakerImportInput,
  type TierMakerUrlImportInput
} from "@/lib/tiermaker-import";
import { formatTierMakerAutoParseError } from "@/lib/tiermaker-url-list";

interface RouteContext {
  params: {
    poolId: string;
  };
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body === null) {
    return badRequest("Invalid JSON body");
  }

  try {
    const user = await requireCurrentUser();

    if (typeof body.url === "string") {
      const result = await importTierMakerFromUrl({
        poolId: context.params.poolId,
        userId: user.id,
        input: body as unknown as TierMakerUrlImportInput
      });

      return ok({
        added: result.added,
        skipped: result.skipped,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount
      }, { status: result.importedCount > 0 ? 201 : 200 });
    }

    const result = await importTierMakerItemsToPool({
      poolId: context.params.poolId,
      userId: user.id,
      input: body as unknown as TierMakerImportInput
    });

    return ok(result, { status: result.importedCount > 0 ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TierMaker import failed";

    if (message === "Pool not found") {
      return notFound(message);
    }

    if (message === "你没有权限访问这个番组。") {
      return forbidden(message);
    }

    if (
      message === "url is required" ||
      message === "templateUrl is required" ||
      message === "templateUrl must be a valid URL" ||
      message === "items are required" ||
      message === "imageUrl is required" ||
      message === "imageUrl must be a valid URL" ||
      message.includes("items cannot contain more than") ||
      message === "No items match the selected indexes"
    ) {
      return badRequest(message);
    }

    if (message === "Archived pools cannot import TierMaker items") {
      return badRequest(message);
    }

    if (
      message.includes("URL is required") ||
      message.includes("URL protocol is not allowed") ||
      message.includes("Invalid URL format") ||
      message.includes("Only HTTPS") ||
      message.includes("must point to tiermaker.com") ||
      message.includes("Blocked hostname") ||
      message.includes("Private IP") ||
      message.includes("must be a TierMaker template") ||
      message.includes("path must start with")
    ) {
      return badRequest(message);
    }

    if (
      message === "No images found in the TierMaker template" ||
      message.includes("TierMaker request timed out") ||
      message.includes("Failed to fetch TierMaker template") ||
      message.includes("TierMaker returned status") ||
      message.includes("TierMaker redirect")
    ) {
      const friendlyMessage = formatTierMakerAutoParseError(message);
      if (friendlyMessage !== message) {
        return badRequest(friendlyMessage);
      }

      return badRequest(message);
    }

    return fromError(error);
  }
}
