export const SEARCH_UI_CONTRACT = Object.freeze({
  debounceMs: 150,
  emptyQueryBehavior: "show-empty-state",
  maxClientEmojiRecords: 4486,
  ambiguousQueries: Object.freeze(["hot"]),
  forbiddenClientImports: Object.freeze(["node:fs", "node:path", "master-reader", "searchProductionEmojis"]),
  forbiddenResultFields: Object.freeze([
    "canonicalId",
    "rawRecordRef",
    "checksum",
    "sourceRecordRef",
    "provenance",
  ]),
});
