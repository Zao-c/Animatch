/** Browser-only delivery scheduler. Local image requests leave HTTP slots for APIs. */
type Lane = "local" | "remote";
type Task = { source: string; lane: Lane; priority: number; start: () => void };
type Options = { signal: AbortSignal; priority?: number; timeoutMs?: number };
const abortError = () => new DOMException("Aborted", "AbortError");

export class CoverRequestQueue {
  private active = { local: 0, remote: 0 };
  private waiting: Task[] = [];
  constructor(private createImage: () => HTMLImageElement = () => new Image(), private limits = { local: 2, remote: 4 }) {}
  load(source: string, { signal, priority = 0, timeoutMs = 10000 }: Options): Promise<string> {
    if (signal.aborted) return Promise.reject(abortError());
    const lane: Lane = source.startsWith("/") ? "local" : "remote";
    return new Promise((resolve, reject) => {
      let image: HTMLImageElement | undefined, timer: ReturnType<typeof setTimeout> | undefined, active = false, settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
        const index = this.waiting.indexOf(task); if (index >= 0) this.waiting.splice(index, 1);
        if (image) { image.onload = null; image.onerror = null; if (error) image.removeAttribute("src"); }
        if (active) this.active[lane]--;
        error ? reject(error) : resolve(source);
        this.pump();
      };
      const abort = () => finish(abortError());
      const task: Task = { source, lane, priority, start: () => {
        active = true; this.active[lane]++;
        try {
          image = this.createImage(); image.referrerPolicy = "no-referrer"; image.decoding = "async";
          image.setAttribute("fetchpriority", priority > 0 ? "low" : "auto");
          image.onload = () => finish(image!.naturalWidth > 0 ? undefined : new Error("Invalid image"));
          image.onerror = () => finish(new Error("Image unavailable"));
          timer = setTimeout(() => finish(new Error("Image timeout")), timeoutMs);
          image.src = source;
          if (image.complete && image.naturalWidth > 0) finish();
        } catch (e) { finish(e instanceof Error ? e : new Error("Image unavailable")); }
      } };
      if (this.waiting.length >= 256) { reject(new Error("Image queue full")); return; }
      signal.addEventListener("abort", abort, { once: true }); this.waiting.push(task); this.pump();
    });
  }
  promote(sources: readonly string[], priority: number) {
    for (const task of this.waiting) if (sources.includes(task.source)) task.priority = Math.min(task.priority, priority);
    this.pump();
  }
  private pump() {
    this.waiting.sort((a, b) => a.priority - b.priority);
    for (;;) {
      const index = this.waiting.findIndex((task) => this.active[task.lane] < this.limits[task.lane]);
      if (index < 0) return;
      this.waiting.splice(index, 1)[0].start();
    }
  }
  stats() { return { active: { ...this.active }, queued: this.waiting.length }; }
}

const queue = new CoverRequestQueue();
const successful = new Map<string, { source: string; expires: number }>();
const failures = new Map<string, number>();
const flights = new Map<string, { promise: Promise<string>; controller: AbortController; users: number; priority: { value: number } }>();
const keyFor = (sources: readonly string[]) => JSON.stringify(sources);
function boundedSet<T>(map: Map<string, T>, key: string, value: T) {
  map.delete(key); while (map.size >= 256) map.delete(map.keys().next().value!); map.set(key, value);
}
export function rememberedCover(sources: readonly string[]) {
  const key = keyFor(sources), cached = successful.get(key);
  if (cached && cached.expires > Date.now()) return cached.source;
  successful.delete(key); return undefined;
}
export function forgetCoverSource(source: string) {
  for (const [key, value] of successful) if (value.source === source) successful.delete(key);
  boundedSet(failures, source, Date.now() + 10000);
}
export function retryCoverSources(sources: readonly string[]) {
  successful.delete(keyFor(sources));
  for (const source of sources) failures.delete(source);
}
function delay(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(abortError());
  if (!ms) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function deliver(sources: readonly string[], signal: AbortSignal, priority: { value: number }) {
  const candidates = sources.filter((source) => (failures.get(source) ?? 0) <= Date.now());
  if (!candidates.length) throw new Error("Images temporarily unavailable");
  const controller = new AbortController(), abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort();
  const deadline = setTimeout(abort, 24000);
  try {
    // A slow primary gets a head start, not an exclusive 15-second wait.
    return await Promise.any(candidates.map(async (source, index) => {
      await delay(index * 800, controller.signal);
      try { return await queue.load(source, { signal: controller.signal, priority: priority.value }); }
      catch (error) { if (!controller.signal.aborted) boundedSet(failures, source, Date.now() + 10000); throw error; }
    }));
  } finally { clearTimeout(deadline); controller.abort(); signal.removeEventListener("abort", abort); }
}
export async function loadCoverImage(sources: readonly string[], { signal, priority = 0 }: Options): Promise<string> {
  if (signal.aborted) throw abortError();
  const key = keyFor(sources), cached = rememberedCover(sources); if (cached) return cached;
  let flight = flights.get(key);
  if (!flight) {
    if (flights.size >= 256) throw new Error("Cover queue full");
    const controller = new AbortController();
    const sharedPriority = { value: priority };
    const promise = deliver(sources, controller.signal, sharedPriority);
    flight = { promise, controller, users: 0, priority: sharedPriority }; flights.set(key, flight);
    const current = flight;
    void promise.then((source) => {
      if (!controller.signal.aborted) boundedSet(successful, key, { source, expires: Date.now() + 10 * 60 * 1000 });
      if (flights.get(key) === current) flights.delete(key);
    }, () => { if (flights.get(key) === current) flights.delete(key); });
  }
  if (priority < flight.priority.value) { flight.priority.value = priority; queue.promote(sources, priority); }
  const current = flight; current.users++;
  try {
    return await new Promise<string>((resolve, reject) => {
      const abort = () => reject(abortError()); signal.addEventListener("abort", abort, { once: true });
      current.promise.then((source) => { signal.removeEventListener("abort", abort); resolve(source); }, (error) => { signal.removeEventListener("abort", abort); reject(error); });
    });
  } finally { if (--current.users === 0) { current.controller.abort(); if (flights.get(key) === current) flights.delete(key); } }
}
export function coverLoaderStats() { return { ...queue.stats(), inFlight: flights.size, remembered: successful.size }; }
