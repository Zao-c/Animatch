import { Visibility } from "@prisma/client";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

const VISIBILITIES = new Set<string>(Object.values(Visibility));

interface CreatePoolBody {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
  tags?: unknown;
}

export async function GET() {
  try {
    const user = await getOrCreateDevUser();
    const pools = await prisma.customPool.findMany({
      where: {
        creatorId: user.id,
        deletedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return ok({
      items: pools
    });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool listing failed");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreatePoolBody | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return badRequest("name is required");
  }

  const visibility =
    typeof body?.visibility === "string" && VISIBILITIES.has(body.visibility)
      ? (body.visibility as Visibility)
      : Visibility.PRIVATE;
  const tags = normalizeTags(body?.tags);

  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.create({
      data: {
        creatorId: user.id,
        name,
        description:
          typeof body?.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        visibility,
        tags
      }
    });

    return ok(pool, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool creation failed");
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}
