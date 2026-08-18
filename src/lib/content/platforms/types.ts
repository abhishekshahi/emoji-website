import type { ContentProvenance } from "../types";

export interface PlatformInfoRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly renderingNotes?: string;
  readonly versionInfo?: string;
  readonly differencesFromUnicode?: string;
  readonly availability?: string;
  readonly provenance: ContentProvenance;
}
