import type { NomineeReference } from "./award-nominations";
export type ReferenceCard = {
  reference: NomineeReference; title: string; subtitle: string; aliases: string[]; summary: string; role: string;
};
export type ReferenceDetail = { card: ReferenceCard; works: { id: number; title: string; role: string }[]; worksUnavailable: boolean };
