// Optional local UI fixtures. No database writes and no third-party API integration.
// Run: node scripts/prepare-anisong-demo.mjs [output directory]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { fetch, EnvHttpProxyAgent } from "undici";

const destination = resolve(process.argv[2] || "output/anisong-demo/music");
const dispatcher = new EnvHttpProxyAgent();
const tracks = [
  { title: "Cipher", filename: "Cipher2.mp3", isrc: "USUAN1100844", color: "#53e4d3", background: "#12273e", clipStart: 35 },
  { title: "Carefree", filename: "Carefree.mp3", isrc: "USUAN1400037", color: "#ffd69a", background: "#542637", clipStart: 20 },
];
await mkdir(destination, { recursive: true });
const manifest = [];
for (const [index, track] of tracks.entries()) {
  const source = `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`;
  const download = `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${track.filename}`;
  const response = await fetch(download, { dispatcher, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`${track.title}: HTTP ${response.status}`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 100000 || audio.length > 20 * 1024 * 1024 || !(/^(audio|application\/octet-stream)/.test(response.headers.get("content-type") || ""))) throw new Error(`${track.title}: unexpected audio response`);
  await writeFile(join(destination, `${track.title}.mp3`), audio);
  // Original vector artwork, rendered as PNG for the app's image-upload flow.
  const graphic = index === 0
    ? `<g fill="none" stroke="${track.color}" stroke-width="2" opacity=".7">${[100, 130, 160, 190].map(r => `<circle cx="400" cy="340" r="${r}"/>`).join("")}<path stroke-width="8" d="M180 340h60l30-60 45 130 50-180 60 220 45-140 35 60h115"/></g>`
    : `<circle cx="400" cy="300" r="155" fill="${track.color}"/><path d="M0 450Q200 300 400 450T800 450V800H0Z" fill="#ae5960"/><path d="M0 520Q200 370 400 520T800 520V800H0Z" fill="#713c51"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${track.background}"/><g font-family="sans-serif"><text x="48" y="68" font-size="18" letter-spacing="5" fill="${track.color}">ANISONG / LISTENING ROOM</text>${graphic}<text x="48" y="622" font-size="80" font-weight="700" fill="#fff">${track.title}</text><text x="52" y="668" font-size="24" fill="${track.color}">Kevin MacLeod</text><text x="52" y="726" font-size="18" fill="#fff" opacity=".8">Music: incompetech.com · CC BY 4.0</text><text x="52" y="758" font-size="14" fill="#fff" opacity=".6">ORIGINAL DEMO ARTWORK / NOT OFFICIAL ALBUM ART</text></g></svg>`;
  await writeFile(join(destination, `${track.title}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(join(destination, `${track.title}.png`));
  manifest.push({ title: track.title, artist: "Kevin MacLeod", kind: "OTHER", source, download, license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", bytes: audio.length, sha256: createHash("sha256").update(audio).digest("hex"), clipStart: track.clipStart, clipLength: 30, changes: "Audio unchanged; playback excerpt configured in app. Original demo cover, not official artwork." });
  console.log(`${track.title}: ${(audio.length / 1024 / 1024).toFixed(1)} MB`);
}
await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(join(destination, "CREDITS.md"), `# AnisongMatch 本地试听素材\n\n${manifest.map(t => `- **${t.title}** — Kevin MacLeod ([incompetech.com](${t.source})), [CC BY 4.0](${t.licenseUrl}). [原始音频](${t.download})。`).join("\n")}\n\n音频文件未修改；应用只播放配置的 30 秒片段。封面是本项目制作的演示图，不是官方专辑封面。曲目用于验证播放和比较，不属于动画 OP / ED。\n\n再分发音乐时请保留作者、作品来源和许可链接；如修改音频请说明修改。\n`);
console.log(`Prepared demo files: ${destination}`);
await dispatcher.close();
