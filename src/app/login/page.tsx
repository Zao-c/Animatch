"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { friendLogin } from "@/lib/client-api";
import { sanitizeNextPath } from "@/lib/safe-redirect";
import { FRIEND_SHARED_PASSWORD } from "@/lib/friend-login-policy";

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
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = sanitizeNextPath(searchParams.get("next"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
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
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto max-w-md py-6">
        <AppCard variant="focus" className="p-5 sm:p-6">
          <h1 className="text-xl font-black text-white">登录 AniMatch</h1>
          <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm leading-6">
            <p>默认密码：<strong className="select-all font-mono text-cyan-200">{FRIEND_SHARED_PASSWORD}</strong></p>
            <p className="text-slate-300">改密自愿；忘记个人密码也可用默认密码登录。</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">这是群共用登录模式，知道共用密码和用户名的人也能进入该账号。请勿复用其他网站的重要密码。</p>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">用户名</span>
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isSubmitting}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="anime-field mt-2"
                required
                minLength={2}
                maxLength={24}
                placeholder="例如：akira"
              />
              <span className="mt-2 block text-xs text-slate-400">新用户名会自动创建账号。</span>
            </label>

            <div>
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-200">密码（共用或个人密码）</label>
              <div className="relative mt-2">
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="current-password" disabled={isSubmitting} className="anime-field pr-20" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-1 min-h-11 rounded-xl px-3 text-sm text-slate-300 hover:text-white">
                  {showPassword ? "隐藏" : "显示"}
                </button>
              </div>
            </div>
            <details className="text-sm text-slate-300"><summary className="cursor-pointer py-3">使用个人密码注册 / 管理员恢复码</summary>
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
