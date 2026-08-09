export interface SearchHighlightSegment {
  readonly text: string;
  readonly highlight: boolean;
}

export function getSearchHighlightSegments(
  text: string,
  query: string,
): readonly SearchHighlightSegment[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return Object.freeze([{ text, highlight: false }]);
  }

  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(normalizedQuery);
  if (index === -1) {
    return Object.freeze([{ text, highlight: false }]);
  }

  return Object.freeze(
    [
      { text: text.slice(0, index), highlight: false },
      { text: text.slice(index, index + normalizedQuery.length), highlight: true },
      { text: text.slice(index + normalizedQuery.length), highlight: false },
    ].filter((segment) => segment.text.length > 0),
  );
}

export function isAmbiguousSearchQuery(query: string): boolean {
  return query.trim().toLowerCase() === "hot";
}
