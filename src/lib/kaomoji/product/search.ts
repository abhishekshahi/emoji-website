import "server-only";
import { searchKaomoji, type SearchHit } from "../processing/phase9/search-index";
import { loadSearchIndex } from "./loader";

export function searchKaomojiPublic(query: string, limit = 24): SearchHit[] {
  return searchKaomoji(loadSearchIndex(), query, limit);
}
