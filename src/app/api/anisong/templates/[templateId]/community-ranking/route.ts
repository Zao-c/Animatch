import { prisma } from "@/lib/db";
import { AppError } from "@/lib/app-error";
import { ok, fromError } from "@/lib/api-response";
import { rankSongs } from "@/lib/anisong/engine";
import type { SongDocument, SongTrack } from "@/lib/anisong/types";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { templateId: string } }) {
  try {
    const template = await prisma.songTemplate.findFirst({
      where: { id: params.templateId, active: true },
      select: { revision: true, document: true, sourceBoardId: true }
    });
    if (!template) throw new AppError("公共曲单不存在或已下架", 404);
    const publicDoc = template.document as unknown as SongDocument;
    const allowed = new Set(publicDoc.tracks.map(track => track.id));
    const currentIdentity = new Map(publicDoc.tracks.map(track => [track.id, [track.title, track.artist, track.anime, track.kind].join("\\u001f")]));
    const [runs, source] = await Promise.all([
      prisma.songBoard.findMany({
        where: { templateId: params.templateId },
        orderBy: { updatedAt: "desc" }, select: { ownerId: true, document: true }, take: 250
      }),
      template.sourceBoardId
        ? prisma.songBoard.findUnique({ where: { id: template.sourceBoardId }, select: { ownerId: true, document: true } })
        : Promise.resolve(null)
    ]);
    // One contribution per account; song identity must still match the current public version.
    const byOwner = new Map<string, SongDocument>();
    if (source) byOwner.set(source.ownerId, source.document as unknown as SongDocument);
    for (const run of runs) if (!byOwner.has(run.ownerId)) byOwner.set(run.ownerId, run.document as unknown as SongDocument);
    const scores = new Map<string, { totalElo: number; participants: number; comparisons: number; track: SongTrack }>(
      publicDoc.tracks.map(track => [track.id, { track, totalElo: 0, participants: 0, comparisons: 0 }])
    );
    let participants = 0, comparisons = 0;
    for (const doc of byOwner.values()) {
      // Never aggregate an outdated or unrelated track across different public versions.
      const valid = new Set(doc.tracks.filter(track => allowed.has(track.id) &&
        currentIdentity.get(track.id) === [track.title, track.artist, track.anime, track.kind].join("\\u001f")).map(track => track.id));
      const votes = doc.events.filter(event => valid.has(event.leftId) && valid.has(event.rightId));
      if (!votes.length) continue;
      const ranking = rankSongs({ ...publicDoc, events: votes, manualTiers: {}, manualOrder: undefined });
      const effective = ranking.progress.effectiveComparisons;
      if (!effective) continue;
      participants++;
      comparisons += effective;
      for (const score of ranking.scores) {
        if (score.compareCount === 0 || score.isHidden) continue;
        const agg = scores.get(score.animeId);
        if (!agg) continue;
        agg.totalElo += score.eloScore;
        agg.participants++;
        agg.comparisons += score.compareCount;
      }
    }
    const rows = [...scores.values()].filter(value => value.participants > 0)
      .map(value => ({
        id: value.track.id, title: value.track.title, artist: value.track.artist, anime: value.track.anime,
        kind: value.track.kind, coverUrl: value.track.coverUrl ?? null,
        score: Math.round(value.totalElo / value.participants * 10) / 10,
        participants: value.participants, comparisons: value.comparisons
      }))
      .sort((a, b) => b.score - a.score || b.participants - a.participants || a.title.localeCompare(b.title));
    return ok({
      trackCount: publicDoc.tracks.length, participants, comparisons, rows,
      provisional: participants < 3, sampled: runs.length >= 250
    }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (error) { return fromError(error); }
}
