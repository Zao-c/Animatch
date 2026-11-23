"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppBadge } from "@/components/ui/AppBadge";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { friendLogin } from "@/lib/client-api";
import { sanitizeNextPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <AppCard variant="focus" className="mx-auto max-w-md p-6">
            <p className="text-sm text-slate-300">正在准备登录...</p>
          </AppCard>
        </PageShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = sanitizeNextPath(searchParams.get("next"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await friendLogin({
        username,
        inviteCode
      });
      router.replace(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请检查用户名和暗号");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto grid max-w-5xl gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <AppBadge tone="status">Friend Pass</AppBadge>
          <h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-5xl">
            输入好友暗号，开始你的个人榜单
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            AniMatch 不需要复杂注册。输入一个用户名和好友暗号，就会进入你自己的动画池、对决记录和 Tier List。
          </p>
        </div>

        <AppCard variant="focus" className="p-5 sm:p-6">
          <h2 className="text-xl font-black text-white">登录 AniMatch</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            如果用户名不存在，系统会自动创建一个新账号。
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="anime-field mt-2"
                required
                minLength={2}
                maxLength={24}
                placeholder="例如：akira"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-200">邀请暗号</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="anime-field mt-2"
                required
                inputMode="numeric"
                placeholder="输入好友暗号"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-400">
                没有好友暗号？请向邀请你的人索取。
              </span>
            </label>

            {error ? <ErrorAlert message={error} /> : null}

            <AppButton type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "正在进入..." : "进入我的 AniMatch"}
            </AppButton>
          </form>

          <Link href="/" className="mt-4 block text-center text-sm text-slate-400 hover:text-white">
            返回首页
          </Link>
        </AppCard>
      </section>
    </PageShell>
  );
}
