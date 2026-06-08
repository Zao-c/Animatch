"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { createPool } from "@/lib/client-api";

export default function NewPoolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "UNLISTED" | "PUBLIC">("PRIVATE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const pool = await createPool({
        name,
        description,
        visibility
      });
      router.push(`/pools/${pool.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建番组失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold text-white">新建番组</h1>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">描述</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-300">可见性</span>
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as "PRIVATE" | "UNLISTED" | "PUBLIC")
              }
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
            >
              <option value="PRIVATE">PRIVATE</option>
              <option value="UNLISTED">UNLISTED</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            disabled={isSubmitting}
            className="rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "创建中..." : "创建番组"}
          </button>
        </form>
      </div>
    </PageShell>
  );
}
