import { PoolStatus, Prisma, Visibility } from "@prisma/client";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { getOrCreateDevUser } from "@/lib/dev-user";
import { prisma } from "@/lib/db";

const VISIBILITIES = new Set<string>(Object.values(Visibility));
const LIST_STATUSES = new Set(["ACTIVE", "ARCHIVED"]);

interface CreatePoolBody {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
  tags?: unknown;
}

export async function GET(request: Request) {
  try {
    const user = await getOrCreateDevUser();
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim().toUpperCase() ?? "";

    if (status && !LIST_STATUSES.has(status)) {
      return badRequest("status must be ACTIVE or ARCHIVED");
    }

    const where: Prisma.CustomPoolWhereInput = {
      creatorId: user.id,
    };

    if (status === "ARCHIVED") {
      where.OR = [{ status: PoolStatus.ARCHIVED }, { deletedAt: { not: null } }];
    } else if (status === "ACTIVE" || !includeArchived) {
      where.status = { not: PoolStatus.ARCHIVED };
      where.deletedAt = null;
    }

    if (q) {
      where.AND = [
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const pools = await prisma.customPool.findMany({
      where,
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
  if (name.length > 80) {
    return badRequest("name must be 80 characters or fewer");
  }

  const description = normalizeDescription(body?.description);
  if (description instanceof Error) {
    return badRequest(description.message);
  }

  const visibility =
    typeof body?.visibility === "string" && VISIBILITIES.has(body.visibility)
      ? (body.visibility as Visibility)
      : Visibility.PRIVATE;
  const tags = normalizeTags(body?.tags);
  if (tags instanceof Error) {
    return badRequest(tags.message);
  }

  try {
    const user = await getOrCreateDevUser();
    const pool = await prisma.customPool.create({
      data: {
        creatorId: user.id,
        name,
        description,
        visibility,
        tags
      }
    });

    return ok(pool, { status: 201 });
  } catch (error) {
    return serverError(error instanceof Error ? error.message : "Pool creation failed");
  }
}

function normalizeTags(value: unknown): string[] | Error {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

  if (tags.length > 10) {
    return new Error("tags cannot contain more than 10 items");
  }

  if (tags.some((tag) => tag.length > 20)) {
    return new Error("tags must be 20 characters or fewer");
  }

  return tags;
}

function normalizeDescription(value: unknown): string | null | Error {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const description = value.trim();
  if (description.length > 500) {
    return new Error("description must be 500 characters or fewer");
  }

  return description || null;
}
