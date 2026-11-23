"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { AppButton } from "@/components/ui/AppButton";
import { featureRequest } from "@/lib/feature-api";
import { FRIEND_SHARED_PASSWORD } from "@/lib/friend-login-policy";
import { sanitizeNextPath } from "@/lib/safe-redirect";
export default function AccountSecurity() {
  const [configured, setConfigured] = useState<boolean | null>(null), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [currentPassword, setCurrent] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [returnTo, setReturnTo] = useState("/pools?view=public");
  useEffect(() => {
    const next = sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
    setReturnTo(next === "/" || next.startsWith("/account/security") || next.startsWith("/login") ? "/pools?view=public" : next);
  }, []);
  useEffect(() => { featureRequest<{ configured: boolean }>("/api/auth/password").then((d) => setConfigured(d.configured)).catch((e) => setError(e.message)); }, []);
  return <PageShell><section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-950/40 p-6"><h1 className="text-2xl font-bold">账号设置</h1>
    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6">
      <p>群共用密码 <strong className="select-all font-mono text-cyan-200">{FRIEND_SHARED_PASSWORD}</strong></p>
      <p className="mt-1 text-slate-300">不改密码也能正常使用。忘记个人密码时，仍可用共用密码登录原账号。</p>
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-400">个人密码由你自愿设置，请勿复用其他网站的重要密码。知道共用密码和用户名的人也能进入该账号；设置个人密码不会关闭共用入口。</p>
    {error && <p role="alert" className="my-4 text-rose-200">{error}</p>}{notice && <p role="status" className="my-4 text-emerald-200">{notice}</p>}
    {configured !== null && <form className="mt-5 space-y-4" onSubmit={async (e) => { e.preventDefault(); if (password !== confirm) { setError("两次密码不一致"); return; } setBusy(true); setError(""); setNotice(""); try { await featureRequest("/api/auth/password", { method: "PUT", body: JSON.stringify({ password, currentPassword }) }); setConfigured(true); setPassword(""); setConfirm(""); setCurrent(""); setNotice("个人密码已保存，共用密码仍可登录。其他设备需重新登录。"); } catch (e) { setError(e instanceof Error ? e.message : "设置失败"); } finally { setBusy(false); } }}>
      <h2 className="font-semibold">{configured ? "更改个人密码" : "设置个人密码（可选）"}</h2>
      {configured && <label className="block">当前密码或群共用密码<input className="anime-field mt-2" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} /></label>}
      <label className="block">新密码（至少 8 字符）<input className="anime-field mt-2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label className="block">再输入一次<input className="anime-field mt-2" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      <AppButton type="submit" variant="primary" disabled={busy}>{busy ? "保存中…" : "保存个人密码"}</AppButton></form>}
    <Link href={returnTo} className="mt-6 inline-flex min-h-11 items-center text-amber-200">{returnTo === "/pools?view=public" ? "返回番组大厅 →" : "返回来源页面 →"}</Link></section></PageShell>;
}
