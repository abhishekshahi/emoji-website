export const PERSONAL_LIBRARY_VERSION = 1 as const;
export const PERSONAL_LIBRARY_STORAGE_KEY = "emojiquick-kaomoji-personal-v1";
export const DEFAULT_FAVORITES_COLLECTION_ID = "favorites";

export type PersonalKaomojiSource = "public" | "generated";

export interface PersonalKaomojiItem {
  readonly id: string;
  readonly content: string;
  readonly slug: string | null;
  readonly name: string | null;
  readonly accessible_name: string;
  readonly source: PersonalKaomojiSource;
  readonly saved_at: string;
}

export interface PersonalCollection {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly item_ids: readonly string[];
  readonly is_default?: boolean;
}

export interface PersonalLibraryStore {
  readonly version: typeof PERSONAL_LIBRARY_VERSION;
  readonly items: Record<string, PersonalKaomojiItem>;
  readonly collections: readonly PersonalCollection[];
}

export interface PersonalSavePayload {
  readonly id: string;
  readonly content: string;
  readonly slug?: string | null;
  readonly name?: string | null;
  readonly accessible_name: string;
  readonly source?: PersonalKaomojiSource;
}
