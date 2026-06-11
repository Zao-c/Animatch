"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appButtonClasses } from "@/components/ui/AppButton";
import { getPool, listPools } from "@/lib/client-api";

type ReadyPool = {
  id: string;
  name: string;
};

type PoolDetailResult = Awaited<ReturnType<typeof getPool>>;

export function HomeActions() {
  const [readyPool, setReadyPool] = useState<ReadyPool | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function findRecentReadyPool() {
      try {
        const data = await listPools({ status: "ACTIVE" });
        const candidates = data.items.slice(0, 4);
        const details = await Promise.allSettled(candidates.map((pool) => getPool(pool.id)));
        const ready = details
          .map((result) => (result.status === "fulfilled" ? result.value : null))
          .find((detail): detail is PoolDetailResult => {
            return (
              detail !== null &&
              detail.anime.length >= 2 &&
              detail.deletedAt == null &&
              detail.status !== "ARCHIVED"
            );
          });

        if (ready !== undefined && !cancelled) {
          setReadyPool({ id: ready.id, name: ready.name });
        }
      } catch {
        if (!cancelled) {
          setReadyPool(null);
        }
      }
    }

    void findRecentReadyPool();

    return () => {
      cancelled = true;
    };
  }, []);

  const primaryHref = readyPool === null ? "/pools/new" : `/pools/${readyPool.id}`;
  const primaryLabel = readyPool === null ? "创建第一个番组" : "继续对决";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href={primaryHref}
        className={appButtonClasses({
          variant: "primary",
          size: "lg",
          className: "w-full sm:w-auto"
        })}
        aria-label={readyPool === null ? primaryLabel : `${primaryLabel}：${readyPool.name}`}
      >
        {primaryLabel}
      </Link>
      <Link
        href="/pools"
        className={appButtonClasses({
          variant: "ghost",
          size: "lg",
          className: "w-full sm:w-auto"
        })}
      >
        查看我的番组
      </Link>
    </div>
  );
}
