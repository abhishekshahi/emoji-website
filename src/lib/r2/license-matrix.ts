import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { isProviderPubliclyServed } from "@/lib/master/r2/licenses";
import type { LicenseMatrix, LicenseMatrixEntry } from "./types";

const PROVIDER_NAME_MAP: Record<ArtworkProvider, string[]> = {
  openmoji: ["OpenMoji"],
  twemoji: ["Twemoji"],
  noto: ["Noto Emoji"],
  fluent: ["Fluent Emoji"],
};

let cachedMatrix: LicenseMatrix | null = null;

export function loadLicenseMatrix(localExportRoot: string): LicenseMatrix | null {
  if (cachedMatrix) return cachedMatrix;
  const path = join(localExportRoot, "licenses", "LICENSE-MATRIX.json");
  if (!existsSync(path)) return null;
  cachedMatrix = JSON.parse(readFileSync(path, "utf8")) as LicenseMatrix;
  return cachedMatrix;
}

export function resetLicenseMatrixCache(): void {
  cachedMatrix = null;
}

export function isArtworkPubliclyServable(
  provider: ArtworkProvider,
  matrix: LicenseMatrix | null,
  recordClass?: string,
): boolean {
  if (recordClass === "A") return isProviderPubliclyServed(provider);
  if (recordClass === "B" || recordClass === "C") return false;

  if (!matrix) {
    return isProviderPubliclyServed(provider);
  }

  const names = PROVIDER_NAME_MAP[provider];
  const entries = matrix.providers.filter((entry: LicenseMatrixEntry) =>
    names.some((name) => entry.provider.toLowerCase().includes(name.toLowerCase())),
  );

  if (entries.length === 0) {
    return isProviderPubliclyServed(provider);
  }

  return entries.some((entry) => entry.publicServingAllowed === true);
}

export function getProviderServingClass(
  provider: ArtworkProvider,
  matrix: LicenseMatrix | null,
): string | null {
  if (matrix?.artworkProviderClasses?.[provider]) {
    return matrix.artworkProviderClasses[provider] ?? null;
  }
  const names = PROVIDER_NAME_MAP[provider];
  const entry = matrix?.providers.find((e) =>
    names.some((name) => e.provider.toLowerCase().includes(name.toLowerCase())),
  );
  return entry?.servingClass ?? null;
}
