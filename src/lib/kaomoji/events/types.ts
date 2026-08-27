export type EventKind = "evergreen" | "seasonal";

export type EventTimingKind = "fixed" | "movable_us" | "lunar_varies" | "none";

export interface EventGuide {
  readonly slug: string;
  readonly kind: EventKind;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly usage: string;
  readonly context: string;
  readonly searchQuery: string;
  readonly categorySlugs: readonly string[];
  readonly intentSlugs: readonly string[];
  readonly collectionSlug: string | null;
  readonly relatedEventSlugs: readonly string[];
  readonly timingKind: EventTimingKind;
  readonly fixedMonth?: number;
  readonly fixedDay?: number;
  readonly seasonStartMonth?: number;
  readonly seasonStartDay?: number;
  readonly seasonEndMonth?: number;
  readonly seasonEndDay?: number;
}

export interface EventTimingDisplay {
  readonly label: string;
  readonly detail: string;
}

export interface EventDiscoveryItem {
  readonly slug: string;
  readonly title: string;
  readonly href: string;
  readonly reason: string;
}
