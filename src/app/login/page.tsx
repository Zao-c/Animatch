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
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
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
        inviteCode, password, recoveryCode
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
            用自己的账号，记录这一年的喜欢
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            已有账号使用个人密码登录。新朋友准备好群邀请码，即可创建账号。
          </p>
        </div>

        <AppCard variant="focus" className="p-5 sm:p-6">
          <h2 className="text-xl font-black text-white">登录 AniMatch</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            旧账号请先在已登录设备设置密码；已退出可向管理员索取一次性恢复码。
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

            <label className="block"><span className="text-sm font-semibold text-slate-200">个人密码</span><input type="password" required minLength={8} maxLength={128} autoComplete="current-password" className="anime-field mt-2" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <details className="text-sm text-slate-300"><summary className="cursor-pointer py-3">注册新账号 / 恢复旧账号</summary>
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">群邀请码（仅注册时需要）</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="anime-field mt-2"
                inputMode="text"
                placeholder="输入好友暗号"
              />
              <span className="mt-2 block text-xs leading-5 text-slate-400">
                没有好友暗号？请向邀请你的人索取。
              </span>
            </label>

            <label className="mt-4 block">一次性恢复码<input autoComplete="off" className="anime-field mt-2" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} /><span className="mt-2 block text-xs text-slate-400">恢复时，上面的个人密码会设置为新密码。</span></label></details>
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
