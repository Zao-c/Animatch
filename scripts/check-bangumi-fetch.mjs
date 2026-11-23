import { resolveProxyUrl, getNoProxyHosts, hostMatchesNoProxy } from "./check-bangumi-helpers.mjs";

const BANGUMI_SEARCH_URL = "https://api.bgm.tv/v0/search/subjects";
const TIMEOUT_MS = 10_000;

function displayProxyStatus() {
  const proxyUrl = resolveProxyUrl();
  if (proxyUrl) {
    const source =
      process.env.ANIMATCH_OUTBOUND_PROXY_URL ? "ANIMATCH_OUTBOUND_PROXY_URL" :
      process.env.HTTPS_PROXY || process.env.https_proxy ? "HTTPS_PROXY" :
      "HTTP_PROXY";
    console.log(`proxy detected via ${source}`);
  } else {
    console.log("proxy: none");
  }
  return proxyUrl;
}

function displayNoProxyCheck(targetHostname) {
  const noProxyHosts = getNoProxyHosts();
  console.log(`NO_PROXY hosts: ${noProxyHosts.join(",")}`);
  const matched = hostMatchesNoProxy(targetHostname);
  console.log(`NO_PROXY match for ${targetHostname}: ${matched}`);
}

async function checkFetch() {
  console.log("=== AniMatch Bangumi Fetch Diagnostic ===");
  console.log();

  const targetUrl = new URL(BANGUMI_SEARCH_URL);
  const targetHost = targetUrl.hostname;

  const proxyUrl = displayProxyStatus();
  displayNoProxyCheck(targetHost);
  console.log();

  console.log(`fetching ${BANGUMI_SEARCH_URL} ...`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  /** @type {Record<string, string>} */
  const headers = {
    "User-Agent": "AniMatch/0.3 (check-bangumi-fetch)"
  };

  let dispatcher;
  if (proxyUrl && !hostMatchesNoProxy(targetHost)) {
    try {
      const { ProxyAgent } = await import("undici");
      dispatcher = new ProxyAgent(proxyUrl);
      console.log("proxy dispatcher: created");
    } catch (e) {
      console.log(`proxy dispatcher: failed to create - ${e.message}`);
    }
  }

  try {
    const fetchOptions = {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ filter: { type: [2] }, sort: "rank" }),
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {})
    };

    const response = await fetch(BANGUMI_SEARCH_URL, fetchOptions);
    clearTimeout(timer);

    console.log(`status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const body = await response.json();
      const count = Array.isArray(body?.data) ? body.data.length : 0;
      console.log(`result: OK (${count} subjects)`);
      console.log("=== Diagnostic: PASS ===");
      process.exit(0);
    } else {
      const text = await response.text().catch(() => "(failed to read body)");
      console.log(`error: HTTP ${response.status}`);
      console.log(`body: ${text.slice(0, 300)}`);
      console.log("=== Diagnostic: FAIL (bad status) ===");
      process.exit(1);
    }
  } catch (error) {
    clearTimeout(timer);
    const message = error?.message ?? String(error);
    const code = error?.code ?? "unknown";

    console.log(`error type: ${error?.name ?? "Error"}`);
    console.log(`error code: ${code}`);
    console.log(`error message: ${message}`);

    if (message.includes("abort") || code === "ABORT_ERR" || error?.name === "AbortError") {
      console.log("=== Diagnostic: FAIL (timeout) ===");
    } else if (message.includes("fetch failed") || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
      console.log("=== Diagnostic: FAIL (connect/network) ===");
    } else {
      console.log("=== Diagnostic: FAIL (unknown) ===");
    }
    process.exit(1);
  }
}

checkFetch();
