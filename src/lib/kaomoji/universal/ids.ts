import { createHash } from "node:crypto";
import type { UniversalContentType } from "../types";

export function buildSourceItemId(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function buildUniversalAggregatedId(candidateKey: string, contentType: UniversalContentType): string {
  return createHash("sha256").update(`universal:${contentType}:${candidateKey}`, "utf8").digest("hex");
}

export function buildUniversalCandidateKey(normalizedContent: string): string {
  return normalizedContent;
}
