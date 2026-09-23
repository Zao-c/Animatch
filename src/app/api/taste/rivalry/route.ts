import { fromError, ok } from "@/lib/api-response";
import { getPublicTasteRivalry } from "@/lib/taste-rivalry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await getPublicTasteRivalry(new URL(request.url).searchParams.get("scope") ?? "");
    return ok(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    return fromError(error);
  }
}
