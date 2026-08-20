export type CloudflareKaomojiMode = "OFF" | "STAGING" | "PRODUCTION";

export const PRODUCTION_VERSION = "2026-08-19-v1" as const;
export const SCHEMA_VERSION = "19.0.0" as const;
export const KAOMOJI_R2_PREFIX = "emojiquick" as const;
export const KAOMOJI_D1_BATCH_SIZE = 500 as const;
export const KAOMOJI_D1_KAOMOJI_BATCH_SIZE = 25 as const;
export const KAOMOJI_D1_RELATIONSHIP_BATCH_SIZE = 100 as const;

export function parseKaomojiCloudflareMode(value: string | undefined): CloudflareKaomojiMode {
  if (value === "STAGING" || value === "PRODUCTION") return value;
  return "OFF";
}

export function getKaomojiCloudflareMode(): CloudflareKaomojiMode {
  return parseKaomojiCloudflareMode(process.env.KAOMOJI_CLOUDFLARE_MODE);
}

export function getKaomojiR2Prefix(): string {
  return KAOMOJI_R2_PREFIX;
}

export function isKaomojiCloudflareEnabled(): boolean {
  const mode = getKaomojiCloudflareMode();
  return mode === "STAGING" || mode === "PRODUCTION";
}

export function isKaomojiProductionMode(): boolean {
  return getKaomojiCloudflareMode() === "PRODUCTION";
}
