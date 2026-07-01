"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppButton, appButtonClasses } from "@/components/ui/AppButton";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { createDemoPool, getMe, getPool, listPools } from "@/lib/client-api";

type ReadyPool = {
  id: string;
  name: string;
};

type PoolDetailResult = Awaited<ReturnType<typeof getPool>>;

export function HomeActions() {
  const [readyPool, setReadyPool] = useState<ReadyPool | null>(null);
  const [isPreparingDemoPool, setIsPreparingDemoPool] = useState(false);
  const [demoPoolError, setDemoPoolError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((data) => { if (!cancelled) setIsLoggedIn(data.user !== null); })
      .catch(() => { if (!cancelled) setIsLoggedIn(false); });

    return () => { cancelled = true; };
  }, []);

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

  const continueHref = readyPool === null ? "/pools/new" : `/pools/${readyPool.id}`;
  const continueLabel = readyPool === null ? "创建第一个番组" : "继续对决";

  async function handleCreateDemoPool() {
    setIsPreparingDemoPool(true);
    setDemoPoolError(null);

    try {
      const result = await createDemoPool();
      window.location.assign(result.redirectTo);
    } catch {
      setDemoPoolError("示例番组创建失败，请稍后重试。");
    } finally {
      setIsPreparingDemoPool(false);
    }
  }

  if (isLoggedIn === null) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/pools?view=public" className={appButtonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}>
          进入番组大厅
        </Link>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/pools?view=public"
            className={appButtonClasses({ variant: "primary", size: "lg", className: "w-full sm:w-auto" })}
          >
            进入番组大厅
          </Link>
          <AppButton
            type="button"
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={handleCreateDemoPool}
            disabled={isPreparingDemoPool}
          >
            {isPreparingDemoPool ? "正在准备体验池..." : "体验示例番组"}
          </AppButton>
          <Link
            href="/login"
            className={appButtonClasses({ variant: "ghost", size: "lg", className: "w-full sm:w-auto" })}
          >
            登录
          </Link>
        </div>
        <p className="text-xs leading-5 text-slate-400">
          不用登录也能进入番组大厅并体验对决。登录后可以创建自己的番组、生成个人 Tier List、参与社区榜单。
        </p>
        {demoPoolError ? <ErrorAlert message={demoPoolError} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/pools?view=public"
          className={appButtonClasses({
            variant: "primary",
            size: "lg",
            className: "w-full sm:w-auto"
          })}
        >
          进入番组大厅
        </Link>
        <Link
          href={continueHref}
          className={appButtonClasses({
            variant: "secondary",
            size: "lg",
            className: "w-full sm:w-auto"
          })}
          aria-label={readyPool === null ? continueLabel : `${continueLabel}：${readyPool.name}`}
        >
          {continueLabel}
        </Link>
        <AppButton
          type="button"
          variant="ghost"
          size="lg"
          className="w-full sm:w-auto"
          onClick={handleCreateDemoPool}
          disabled={isPreparingDemoPool}
        >
          {isPreparingDemoPool ? "正在准备体验池..." : "体验示例番组"}
        </AppButton>
      </div>
      {demoPoolError ? <ErrorAlert message={demoPoolError} /> : null}
    </div>
  );
}
