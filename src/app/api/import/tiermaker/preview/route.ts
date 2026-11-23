import { badRequest, ok, fromError } from "@/lib/api-response";
import { requireCurrentUser } from "@/lib/auth-session";
import {
  fetchTierMakerTemplate,
  parseTierMakerTemplate
} from "@/lib/tiermaker-fetch";
import { formatTierMakerAutoParseError } from "@/lib/tiermaker-url-list";

export async function POST(request: Request) {
  let body: { url?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (body === null || typeof body.url !== "string" || !body.url.trim()) {
    return badRequest("url is required");
  }

  try {
    await requireCurrentUser();
    const { html, finalUrl } = await fetchTierMakerTemplate(body.url);
    const result = parseTierMakerTemplate(html, finalUrl);

    return ok({
      title: result.title,
      sourceUrl: result.sourceUrl,
      total: result.total,
      items: result.items.map((item) => ({
        title: item.title,
        imageUrl: item.imageUrl,
        sourceIndex: item.sourceIndex
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TierMaker preview failed";

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

    if (message === "No images found in the TierMaker template") {
      return badRequest(message);
    }

    const friendlyMessage = formatTierMakerAutoParseError(message);
    if (friendlyMessage !== message) {
      return badRequest(friendlyMessage);
    }

    return fromError(error);
  }
}
