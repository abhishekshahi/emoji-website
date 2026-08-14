import type { FullArchiveDuplicateGroup, FullArchiveFileEntry } from "./types";

export function buildDuplicateReport(
  files: readonly FullArchiveFileEntry[],
): FullArchiveDuplicateGroup[] {
  const byHash = new Map<string, FullArchiveFileEntry[]>();

  for (const file of files) {
    const group = byHash.get(file.sha256) ?? [];
    group.push(file);
    byHash.set(file.sha256, group);
  }

  return [...byHash.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({
      sha256,
      bytes: group[0]?.bytes ?? 0,
      files: group.map((entry) => entry.relativePath).sort(),
    }))
    .sort((left, right) => right.files.length - left.files.length);
}

export function duplicateReportSummary(groups: readonly FullArchiveDuplicateGroup[]): {
  readonly duplicateGroups: number;
  readonly duplicateFiles: number;
  readonly redundantBytes: number;
} {
  let duplicateFiles = 0;
  let redundantBytes = 0;

  for (const group of groups) {
    duplicateFiles += group.files.length;
    redundantBytes += group.bytes * (group.files.length - 1);
  }

  return {
    duplicateGroups: groups.length,
    duplicateFiles,
    redundantBytes,
  };
}
