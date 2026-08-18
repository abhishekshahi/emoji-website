const MISSPELLINGS: Record<string, string> = {
  hart: "heart",
  luv: "love",
  laff: "laugh",
  laffing: "laughing",
  congradulations: "congratulations",
  birtday: "birthday",
  smily: "smile",
  happpy: "happy",
  girfriend: "girlfriend",
  cumpleanos: "cumpleaños",
  anniverssaire: "anniversaire",
  geburtstag: "geburtstag",
  geburstag: "geburtstag",
  corazon: "corazón",
};

export function normalizeSearchQuery(input: string): string {
  let q = input.trim().toLowerCase();
  q = q.replace(/^u\+/i, "u+");
  q = q.replace(/[\u2018\u2019']/g, "");
  q = q.replace(/[^\p{L}\p{N}\s+\-:]/gu, " ");
  q = q.replace(/\s+/g, " ").trim();
  return MISSPELLINGS[q] ?? q;
}

export function isUnicodeCodePointQuery(input: string): boolean {
  const trimmed = input.trim();
  return /^u\+?[0-9a-f]{4,6}(?:[-\s][0-9a-f]{4,6})*$/i.test(trimmed) ||
    /^[0-9a-f]{4,6}(?:-[0-9a-f]{4,6})+$/i.test(trimmed);
}

export function expandUnicodeQuery(input: string): string {
  return input.trim().replace(/^u\+/i, "").replace(/\s+/g, "-").toLowerCase();
}
