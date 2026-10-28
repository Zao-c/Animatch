import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./app-error";

export function poolCreationKey(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new AppError("创建编号无效，请重新加载创建页面。", 400, "INVALID_CREATION_KEY");
  return value;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}

export function poolCreationHash(body: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
}

export async function readPoolCreation<T>(userId: string, key: string | undefined, hash: string, tx: Prisma.TransactionClient = prisma): Promise<T | null> {
  if (!key) return null;
  const existing = await tx.poolCreationRequest.findUnique({ where: { userId_clientMutationId: { userId, clientMutationId: key } } });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new AppError("这次创建的内容与原请求不同，请先确认原创建结果。", 409, "CREATION_CONTENT_CHANGED");
  const pool = await tx.customPool.findUnique({ where: { id: existing.poolId }, select: { creatorId: true, deletedAt: true } });
  if (!pool || pool.deletedAt || pool.creatorId !== userId) throw new AppError("这次请求已创建过番组，但该番组现已删除或不可访问。请到我的番组查看；重试不会再次创建。", 410, "CREATED_POOL_UNAVAILABLE");
  return existing.result as T;
}

export async function createPoolOnce<T>(userId: string, key: string | undefined, hash: string,
  create: (tx: Prisma.TransactionClient) => Promise<{ poolId: string; result: T }>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await readPoolCreation<T>(userId, key, hash, tx);
        if (existing !== null) return existing;
        const created = await create(tx);
        if (key) await tx.poolCreationRequest.create({ data: { userId, clientMutationId: key, requestHash: hash, poolId: created.poolId,
          result: JSON.parse(JSON.stringify(created.result)) as Prisma.InputJsonValue } });
        return created.result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const conflict = error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code);
      if (!conflict) throw error;
      // A concurrent request may have committed while this transaction rolled back.
      const existing = await readPoolCreation<T>(userId, key, hash);
      if (existing !== null) return existing;
      if (attempt === 2) throw new AppError("创建请求正在处理，请重试确认原请求。", 409, "CREATION_BUSY");
      await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
    }
  }
  throw new AppError("请重试确认创建结果。", 409, "CREATION_BUSY");
}
