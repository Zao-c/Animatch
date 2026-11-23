import { HomeActions } from "@/components/HomeActions";
import { HomeMiniMatchDemo } from "@/components/home/HomeMiniMatchDemo";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  return (
    <PageShell>
      <section className="grid items-center gap-8 py-6 lg:min-h-[65vh] lg:grid-cols-[minmax(0,1fr)_minmax(420px,600px)] lg:gap-12">
        <div className="min-w-0">
          <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">动画对决</h1>
          <div className="mt-7"><HomeActions /></div>
        </div>
        <HomeMiniMatchDemo />
      </section>
    </PageShell>
  );
}
