import type { Metadata } from "next";
import { HubLayout } from "@/components/hub/hub-layout";
import { listPublishedCombinations } from "@/lib/content/combinations/registry";
import { createPageMetadata } from "@/lib/seo/metadata";
import { GeneratorIntentGrid } from "./generator-intent-grid";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Combination Generator",
  description: "Quality-first emoji combination generator foundation on EmojiQuick — intent, mood, and context aware.",
  path: "/combinations/generator",
});

const GENERATOR_INTENTS = [
  { id: "love", label: "Love", comboSlug: "love-sparkle" },
  { id: "romance", label: "Romance", comboSlug: "love-heart" },
  { id: "birthday", label: "Birthday", comboSlug: "party-cake" },
  { id: "celebration", label: "Celebration", comboSlug: "party-celebration" },
  { id: "congratulations", label: "Congratulations", comboSlug: "congrats-trophy" },
  { id: "friendship", label: "Friendship", comboSlug: "friendship-wave" },
  { id: "funny", label: "Funny", comboSlug: "laugh-fire" },
  { id: "sad", label: "Sad / mixed", comboSlug: "laugh-cry" },
  { id: "happy", label: "Happy", comboSlug: "love-sparkle" },
  { id: "cute", label: "Cute", comboSlug: "love-heart" },
  { id: "hype", label: "Hype", comboSlug: "fire-hundred" },
  { id: "gaming", label: "Gaming humor", comboSlug: "skull-laugh" },
  { id: "instagram", label: "Instagram flair", comboSlug: "love-sparkle" },
  { id: "whatsapp", label: "WhatsApp thanks", comboSlug: "thanks-heart" },
  { id: "work", label: "Support thanks", comboSlug: "pray-heart" },
  { id: "travel", label: "Travel", comboSlug: "travel-adventure" },
  { id: "food", label: "Food vibes", comboSlug: "party-cake" },
  { id: "thanks", label: "Thank you", comboSlug: "thanks-heart" },
  { id: "apology", label: "Apology", comboSlug: "sorry-plead" },
] as const;

export default function CombinationGeneratorPage() {
  const combinations = listPublishedCombinations();

  return (
    <HubLayout
      path="/combinations/generator"
      title="Combination Generator"
      description="Pick an intent or mood to get a curated emoji combination — quality over random sequences."
      eyebrow="Generator"
      links={[{ href: "/combinations", label: "All combinations" }]}
    >
      <p className="text-sm text-muted">
        This is a quality-first generator foundation. It returns curated editorial combinations — not random permutations.
      </p>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Choose a mood</h2>
        <GeneratorIntentGrid intents={GENERATOR_INTENTS} combinations={combinations} />
      </section>

      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Select an intent (love, celebration, funny, hype)</li>
          <li>View the curated combination with meaning and usage</li>
          <li>Copy the sequence with one click on the combination page</li>
        </ul>
        <p className="text-xs text-muted">Future: save, share, and custom length — architecture ready.</p>
      </section>
    </HubLayout>
  );
}
