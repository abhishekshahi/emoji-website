export type SeoRolloutMode = "OFF" | "CANARY" | "FULL";

const VALID_MODES = new Set<SeoRolloutMode>(["OFF", "CANARY", "FULL"]);

let testOverride: SeoRolloutMode | null = null;

export function parseSeoRolloutMode(value: string | undefined): SeoRolloutMode {
  if (!value) {
    return "OFF";
  }
  const normalized = value.trim().toUpperCase();
  if (VALID_MODES.has(normalized as SeoRolloutMode)) {
    return normalized as SeoRolloutMode;
  }
  return "OFF";
}

export function getSeoRolloutMode(): SeoRolloutMode {
  if (testOverride !== null) {
    return testOverride;
  }
  return parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE);
}

export function isSeoMigrationRolloutActive(): boolean {
  const mode = getSeoRolloutMode();
  return mode === "CANARY" || mode === "FULL";
}

export function runWithSeoRolloutMode<T>(mode: SeoRolloutMode, fn: () => T): T {
  const previous = testOverride;
  testOverride = mode;
  try {
    return fn();
  } finally {
    testOverride = previous;
  }
}

