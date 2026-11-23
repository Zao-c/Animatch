import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "数据来源与许可 · AniMatch" };

export default function DataSourcesPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl space-y-8 text-sm leading-7 text-slate-300 [&_a]:text-cyan-200 [&_a]:underline [&_a]:underline-offset-4">
        <h1 className="text-3xl font-black text-white">数据来源与许可</h1>
        <section>
          <h2 className="mb-2 text-lg font-bold text-white">Bangumi</h2>
          <p>作品搜索与导入使用 <a href="https://bgm.tv/">Bangumi 番组计划</a> 的数据。作品详情中的来源链接指向原始条目。</p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-white">anime-offline-database</h2>
          <p>本地目录包含从 <a href="https://github.com/manami-project/anime-offline-database">manami-project/anime-offline-database</a> 导入的动画元数据。</p>
          <p>Contains information from anime-offline-database, which is made available here under the <a href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL) 1.0</a>. Individual database contents are available under the <a href="https://opendatacommons.org/licenses/dbcl/1-0/">Database Contents License (DbCL) 1.0</a>.</p>
          <p><a href="https://github.com/manami-project/anime-offline-database/blob/master/LICENSE">原始许可声明</a></p>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold text-white">用户导入内容</h2>
          <p>番组也可包含用户上传、手动录入或从 TierMaker 导入的内容。封面及作品相关素材的权利归各自权利人所有；项目的 MIT 许可不涵盖这些素材。</p>
        </section>
        <Link href="/pools?view=public" className="inline-flex min-h-11 items-center">返回番组大厅</Link>
      </article>
    </PageShell>
  );
}
