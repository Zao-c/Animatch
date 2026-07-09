import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const SERIALIZABLE_RETRY_ATTEMPTS = 3;

export type PoolAnimePositionTx = Prisma.TransactionClient;

export async function withPoolAnimePositionTransaction<T>(
  operation: (tx: PoolAnimePositionTx) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  if (typeof prisma.$transaction !== "function") {
    return operation(prisma as unknown as PoolAnimePositionTx);
  }

  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      lastError = error;

      if (!isSerializableWriteConflict(error) || attempt === SERIALIZABLE_RETRY_ATTEMPTS) {
        break;
      }
    }
  }

  throw lastError;
}

export async function getNextPoolAnimePosition(
  tx: PoolAnimePositionTx,
  poolId: string
): Promise<number> {
  const maxPosition = await tx.poolAnime.aggregate({
    where: {
      poolId
    },
    _max: {
      position: true
    }
  });

  return (maxPosition._max.position ?? 0) + 1;
}

function isSerializableWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}
