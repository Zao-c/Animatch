import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importManamiSubjects } from "@/lib/anime-service";

interface ManamiDocument {
  data?: unknown;
}

interface ManamiAnimeRaw {
  sources?: string[];
  title?: string;
  type?: string;
  episodes?: number;
  status?: string;
  animeSeason?: { season?: string; year?: number };
  picture?: string;
  thumbnail?: string;
  score?: { arithmeticGeometricMean?: number };
  synonyms?: string[];
  studios?: string[];
  tags?: string[];
}

function parseArgs(): { file?: string; limit?: number; popularOnly?: boolean } {
  const args = process.argv.slice(2);
  const result: { file?: string; limit?: number; popularOnly?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      result.file = args[++i];
    } else if (args[i] === "--limit" && args[i + 1]) {
      result.limit = parseInt(args[++i], 10);
    } else if (args[i] === "--popular-only") {
      result.popularOnly = true;
    }
  }

  return result;
}

async function main() {
  const config = parseArgs();

  if (!config.file) {
    console.error("ERROR: --file is required");
    console.error("Usage: tsx scripts/import-manami-anime.ts --file data/anime-offline-database-minified.json [--limit 5000] [--popular-only]");
    process.exit(1);
  }

  const filePath = resolve(config.file);
  console.log("Reading", filePath, "...");

  let items: ManamiAnimeRaw[];

  try {
    const content = readFileSync(filePath, "utf-8");
    const json = JSON.parse(content) as ManamiDocument;
    const data = Array.isArray(json.data) ? json.data : [];

    if (data.length === 0) {
      console.error("ERROR: No data found in file");
      process.exit(1);
    }

    items = data as ManamiAnimeRaw[];
  } catch (err) {
    console.error("ERROR reading file:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`Found ${items!.length} items in file`);

  let finalItems = items!;

  // Apply popular-only filter
  if (config.popularOnly) {
    finalItems = finalItems.filter((item) => {
      const score = item.score?.arithmeticGeometricMean;
      return typeof score === "number" && score >= 7.0;
    });
    console.log(`Filtered to ${finalItems.length} popular items (score >= 7.0)`);
  }

  // Apply limit
  if (config.limit && config.limit > 0) {
    finalItems = finalItems.slice(0, config.limit);
    console.log(`Limited to ${finalItems.length} items`);
  }

  console.log("Importing...");
  const startTime = Date.now();

  const manamiInput = finalItems.map((item) => ({
    sources: item.sources ?? [],
    title: item.title ?? "Unknown",
    type: item.type ?? "UNKNOWN",
    episodes: typeof item.episodes === "number" ? Math.max(0, Math.trunc(item.episodes)) : 0,
    status: item.status ?? "UNKNOWN",
    animeSeason: item.animeSeason && (item.animeSeason.season || item.animeSeason.year)
      ? { season: item.animeSeason.season ?? "UNKNOWN", year: item.animeSeason.year ?? 0 }
      : null,
    picture: item.picture ?? "",
    thumbnail: item.thumbnail ?? "",
    score: item.score?.arithmeticGeometricMean !== undefined
      ? { arithmeticGeometricMean: item.score.arithmeticGeometricMean }
      : null,
    synonyms: item.synonyms ?? [],
    studios: (item.studios ?? []).filter((s): s is string => typeof s === "string"),
    tags: (item.tags ?? []).filter((t): t is string => typeof t === "string"),
  }));

  const result = await importManamiSubjects(manamiInput, 0);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("");
  console.log("=== Import Complete ===");
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Skipped:  ${result.skipped}`);
  console.log(`  Failed:   ${result.failed}`);
  console.log(`  Duration: ${duration}s`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
