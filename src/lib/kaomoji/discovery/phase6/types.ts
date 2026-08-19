import type { Phase5CollectionManifest, Phase5SourceInventoryRow } from "../phase5/types";

export interface Phase6CollectionManifest extends Omit<Phase5CollectionManifest, "phase"> {
  readonly phase: 6;
  readonly phase6_gaps_closed: readonly string[];
  readonly fastemoji_canonical_discovered: number | null;
  readonly fastemoji_canonical_collected: number | null;
  readonly fastemoji_canonical_remaining: number | null;
}

export type Phase6SourceInventoryRow = Phase5SourceInventoryRow;
