export function getSearchMatchLabel(score: number): string | null {
  if (score >= 1000) return "Exact emoji";
  if (score >= 900) return "Unicode match";
  if (score >= 880) return "Hex code match";
  if (score >= 800) return "Shortcode match";
  if (score >= 750) return "Canonical match";
  if (score >= 700) return "Name match";
  if (score >= 600) return "Alias match";
  if (score >= 500) return "Keyword match";
  if (score >= 420) return "Category match";
  if (score >= 350) return "Meaning match";
  if (score >= 300) return "Partial name";
  if (score >= 200) return "Related term";
  if (score >= 100) return "Fuzzy match";
  return null;
}
