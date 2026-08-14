export type PublicMasterPlatformMode = "OFF" | "LOCAL" | "ENABLED";

export const PUBLIC_MASTER_PLATFORM_VERSION = "EmojiQuick Master Data v1" as const;

export function parsePublicMasterPlatformMode(value: string | undefined): PublicMasterPlatformMode {
  if (value === "ENABLED" || value === "LOCAL" || value === "OFF") {
    return value;
  }
  return process.env.NODE_ENV === "development" ? "LOCAL" : "OFF";
}

export function getPublicMasterPlatformMode(): PublicMasterPlatformMode {
  return parsePublicMasterPlatformMode(process.env.PUBLIC_MASTER_PLATFORM_MODE);
}

export function isPublicMasterPlatformEnabled(): boolean {
  const mode = getPublicMasterPlatformMode();
  return mode === "LOCAL" || mode === "ENABLED";
}

export function isPublicMasterApiEnabled(): boolean {
  return isPublicMasterPlatformEnabled();
}

export const PUBLIC_CATALOG_PAGE_SIZE = 48 as const;
export const PUBLIC_API_MAX_PAGE_SIZE = 100 as const;
export const PUBLIC_API_DEFAULT_PAGE_SIZE = 50 as const;
