import { PRODUCTION_VERSION, getKaomojiR2Prefix } from "./config";

export function buildKaomojiR2Key(...segments: readonly string[]): string {
  return [getKaomojiR2Prefix(), ...segments].join("/");
}

export function buildKaomojiProductionRootKey(version: string = PRODUCTION_VERSION): string {
  return buildKaomojiR2Key("kaomoji", "production", version);
}

export function buildKaomojiManifestKey(version: string = PRODUCTION_VERSION): string {
  return buildKaomojiProductionRootKey(version) + "/manifest.json";
}

export function buildKaomojiSearchIndexKey(version: string = PRODUCTION_VERSION): string {
  return buildKaomojiProductionRootKey(version) + "/search-index-v2.json";
}

export function buildKaomojiLocaleRegistryKey(version: string = PRODUCTION_VERSION): string {
  return buildKaomojiProductionRootKey(version) + "/locale-registry.json";
}

export function buildKaomojiChecksumsKey(version: string = PRODUCTION_VERSION): string {
  return buildKaomojiProductionRootKey(version) + "/checksums.json";
}

export function buildKaomojiBackupKey(version: string, filename: string): string {
  return buildKaomojiR2Key("kaomoji", "backups", version, filename);
}

export function buildKaomojiRollbackManifestKey(version: string): string {
  return buildKaomojiBackupKey(version, "rollback-manifest.json");
}

export function buildKaomojiD1ExportKey(version: string, batchName: string): string {
  return buildKaomojiProductionRootKey(version) + "/d1/" + batchName;
}

export function assertSafeKaomojiR2Key(key: string): void {
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Unsafe kaomoji R2 key: " + key);
  }
  if (!key.startsWith(getKaomojiR2Prefix() + "/")) {
    throw new Error("Kaomoji R2 key outside approved prefix: " + key);
  }
}
