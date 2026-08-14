import { existsSync } from "node:fs";
import { join } from "node:path";
import { R2_EXPORT_DIR } from "../config";
import { isMasterR2ApiEnabled, shouldReadFromR2Binding } from "../config";
import { LocalMasterDataProvider } from "./local";
import type { R2BucketBinding } from "./r2";
import type { MasterDataProvider } from "./types";
import { MasterR2Adapter } from "@/lib/r2/master-r2";

let cachedProvider: MasterDataProvider | null = null;

class CanonicalR2BridgeProvider implements MasterDataProvider {
  constructor(private readonly adapter: MasterR2Adapter) {}

  async getManifest() {
    const result = await this.adapter.getManifest("master-manifest.json");
    return (result?.data as never) ?? null;
  }

  async getIdentity(canonicalId: string) {
    const result = await this.adapter.getIdentity(canonicalId);
    return (result?.data as never) ?? null;
  }

  async getArtworkKey() {
    return null;
  }

  async getArtworkBytes(storageKey: string) {
    const match = /^artwork\/([a-f0-9]{64})\.(svg|png|bin)$/.exec(storageKey);
    if (!match) return null;
    return this.adapter.getArtworkBinary(match[1]!, match[2] as "svg" | "png" | "bin");
  }

  async listArtworkKeysForCanonical() {
    return [];
  }

  async isArtworkKeyAllowed(storageKey: string) {
    return /^artwork\/[a-f0-9]{64}\.(svg|png)$/.test(storageKey);
  }
}

export function createMasterDataProvider(options?: {
  rootDir?: string;
  r2Bucket?: R2BucketBinding;
}): MasterDataProvider | null {
  if (!isMasterR2ApiEnabled()) {
    return null;
  }

  const rootDir = options?.rootDir ?? process.cwd();
  const canonicalExportRoot = join(rootDir, "r2-export");

  if (shouldReadFromR2Binding() && options?.r2Bucket) {
    return new CanonicalR2BridgeProvider(new MasterR2Adapter({ exportRoot: canonicalExportRoot, binding: options.r2Bucket }));
  }

  if (existsSync(join(canonicalExportRoot, "identities"))) {
    return new CanonicalR2BridgeProvider(new MasterR2Adapter({ exportRoot: canonicalExportRoot, binding: null }));
  }

  const exportRootDir = join(rootDir, R2_EXPORT_DIR, "emojiquick");
  return new LocalMasterDataProvider({ exportRootDir });
}

export function getMasterDataProvider(options?: {
  rootDir?: string;
  r2Bucket?: R2BucketBinding;
}): MasterDataProvider | null {
  if (!cachedProvider) {
    cachedProvider = createMasterDataProvider(options);
  }
  return cachedProvider;
}

export function resetMasterDataProviderCache(): void {
  cachedProvider = null;
}
