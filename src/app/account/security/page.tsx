"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton } from "@/components/ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
export default function AccountSecurity() {
  const [configured, setConfigured] = useState<boolean | null>(null), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [currentPassword, setCurrent] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => { featureRequest<{ configured: boolean }>("/api/auth/password").then((d) => setConfigured(d.configured)).catch((e) => setError(e.message)); }, []);
  return <PageShell><section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-950/40 p-6"><h1 className="text-2xl font-bold">账号安全</h1><p className="mt-3 text-sm text-slate-300">设置个人密码，保护你的提名和选票。群邀请码只用于注册。</p>
    {error && <p role="alert" className="my-4 text-rose-200">{error}</p>}{notice && <p role="status" className="my-4 text-emerald-200">{notice}</p>}
    {configured !== null && <form className="mt-5 space-y-4" onSubmit={async (e) => { e.preventDefault(); if (password !== confirm) { setError("两次密码不一致"); return; } setBusy(true); setError(""); try { await featureRequest("/api/auth/password", { method: "PUT", body: JSON.stringify({ password, currentPassword }) }); setConfigured(true); setPassword(""); setConfirm(""); setCurrent(""); setNotice("密码已设置。其他设备需要用新密码重新登录。"); } catch (e) { setError(e instanceof Error ? e.message : "设置失败"); } finally { setBusy(false); } }}>
      {configured && <label className="block">当前密码<input className="anime-field mt-2" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></label>}
      <label className="block">新密码（至少 8 字符）<input className="anime-field mt-2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label className="block">再输入一次<input className="anime-field mt-2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      <AppButton type="submit" variant="primary" disabled={busy}>{busy ? "保存中…" : "保存个人密码"}</AppButton></form>}
    <Link href="/ceremonies" className="mt-6 inline-flex min-h-11 items-center text-amber-200">返回年度活动 →</Link></section></PageShell>;
}
