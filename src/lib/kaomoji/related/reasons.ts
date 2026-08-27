/** User-facing labels for relationship signals — not algorithm scores. */
export function relatedReasonLabel(relationshipType: string, categoryLabel?: string | null): string {
  switch (relationshipType) {
    case "variant":
    case "similar_expression":
      return "Similar expression";
    case "same_category":
      return categoryLabel?.trim() ? categoryLabel.trim() : "Same category";
    case "same_emotion":
      return categoryLabel?.trim() ? categoryLabel.trim() : "Same emotion";
    case "alternative":
      return "Alternative style";
    case "opposite_emotion":
      return "Opposite emotion";
    case "same_style":
      return "Same style";
    case "frequently_paired":
      return "Often paired";
    case "same_collection":
      return "Same collection";
    default:
      return "Related";
  }
}
