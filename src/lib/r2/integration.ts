import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import { searchMasterIntegrated } from "@/lib/master/integration/search/adapter";
import { isMasterR2ApiEnabled } from "@/lib/master/r2/config";
import { getMasterR2Adapter } from "./master-r2";
import type { CanonicalSearchRecord } from "./types";

export function isR2MasterBackendConfigured(): boolean {
  return isMasterR2ApiEnabled();
}

export function isR2MetadataBackendActive(): boolean {
  return isR2MasterBackendConfigured() && MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;
}

export function isR2ArtworkBackendActive(): boolean {
  return isR2MasterBackendConfigured() && MASTER_INTEGRATION_CONFIG.masterArtworkEnabled;
}

export function isR2SearchBackendActive(): boolean {
  return isR2MasterBackendConfigured() && MASTER_INTEGRATION_CONFIG.masterSearchEnabled;
}

/**
 * Server-side search: uses local ranking index, then fetches only matching R2 search
 * records for the top candidates (never all 6,955 search JSON files).
 */
export async function searchMasterViaR2(
  query: string,
  rootDir?: string,
  limit = 50,
): Promise<{
  query: string;
  results: Array<{ canonicalId: string; score: number; r2Search: CanonicalSearchRecord | null }>;
  ambiguous: boolean;
}> {
  const ranked = searchMasterIntegrated(query, rootDir, limit);
  const adapter = await getMasterR2Adapter();

  const enriched = await Promise.all(
    ranked.results.map(async (result) => {
      let r2Search: CanonicalSearchRecord | null = null;
      if (adapter && isR2SearchBackendActive()) {
        const fromR2 = await adapter.getSearch(result.canonicalId);
        r2Search = fromR2?.data ?? null;
      }
      return {
        canonicalId: result.canonicalId,
        score: result.score,
        r2Search,
      };
    }),
  );

  return {
    query,
    results: enriched,
    ambiguous: ranked.ambiguous,
  };
}

export function mapSearchRecordToUiFields(search: CanonicalSearchRecord | null): {
  safeKeywords: string[];
  safeAliases: string[];
  shortcodes: string[];
  canonicalName: string;
} | null {
  if (!search) return null;
  return {
    canonicalName: search.canonicalName,
    safeKeywords: [...search.keywords].slice(0, 12),
    safeAliases: [...search.aliases].slice(0, 8),
    shortcodes: [...search.shortcodes].slice(0, 8),
  };
}
