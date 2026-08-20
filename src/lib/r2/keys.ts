/** Canonical R2 object key helpers for emojiquick-master (no bucket prefix). */

export function safeCanonicalFileName(canonicalId: string): string {
  return canonicalId.replace(/[^a-zA-Z0-9._+-]/g, "_");
}

export function identityKey(canonicalId: string): string {
  return `identities/${safeCanonicalFileName(canonicalId)}.json`;
}

export function metadataKey(canonicalId: string): string {
  return `metadata/${safeCanonicalFileName(canonicalId)}.json`;
}

export function semanticKey(canonicalId: string): string {
  return `semantic/${safeCanonicalFileName(canonicalId)}.json`;
}

export function searchKey(canonicalId: string): string {
  return `search/${safeCanonicalFileName(canonicalId)}.json`;
}

export function provenanceKey(canonicalId: string): string {
  return `provenance/${safeCanonicalFileName(canonicalId)}.json`;
}

export function artworkRecordKey(filePathHash: string): string {
  return `artwork-records/${filePathHash}.json`;
}

export function artworkBinaryKey(checksum: string, ext: "svg" | "png" | "bin"): string {
  return `artwork/${checksum}.${ext}`;
}

export function manifestKey(fileName: string): string {
  return `manifests/${fileName}`;
}

export function licenseKey(fileName: string): string {
  return `licenses/${fileName}`;
}

export function assertSafeObjectKey(key: string): void {
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid object key");
  }
}
