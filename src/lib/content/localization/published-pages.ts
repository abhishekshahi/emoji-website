import type { SupportedLanguage } from "./types";

export interface PublishedLocalizedPage {
  readonly language: SupportedLanguage;
  readonly slug: string;
  readonly canonicalId: string;
  readonly localizedTitle: string;
  readonly localizedDescription: string;
}

/** Only pages with actual localized content — no empty language shells. */
export const PUBLISHED_LOCALIZED_PAGES: readonly PublishedLocalizedPage[] = [
  { language: "es", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "Fuego", localizedDescription: "Calor, intensidad o algo trending." },
  { language: "es", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "Corazón rojo", localizedDescription: "Amor y afecto." },
  { language: "fr", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "Feu", localizedDescription: "Chaleur, intensité ou hype." },
  { language: "fr", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "Cœur rouge", localizedDescription: "Amour et tendresse." },
  { language: "hi", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "आग", localizedDescription: "गर्मी, उत्साह, या ट्रेंडिंग।" },
  { language: "hi", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "लाल दिल", localizedDescription: "प्यार और स्नेह।" },
  { language: "de", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "Rotes Herz", localizedDescription: "Liebe und Zuneigung." },
  { language: "de", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "Feuer", localizedDescription: "Hitze, Hype oder etwas Trendiges." },
  { language: "ja", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "赤いハート", localizedDescription: "愛と親しみ。" },
  { language: "pt", slug: "red-heart", canonicalId: "unicode:2764", localizedTitle: "Coração vermelho", localizedDescription: "Amor e carinho." },
  { language: "es", slug: "face-with-tears-of-joy", canonicalId: "unicode:1F602", localizedTitle: "Cara llorando de risa", localizedDescription: "Risa intensa o algo muy gracioso." },
  { language: "fr", slug: "face-with-tears-of-joy", canonicalId: "unicode:1F602", localizedTitle: "Visage pleurant de joie", localizedDescription: "Rire intense ou moment hilarant." },
  { language: "hi", slug: "face-with-tears-of-joy", canonicalId: "unicode:1F602", localizedTitle: "हँसी के आँसू वाला चेहरा", localizedDescription: "ज़ोर की हँसी या बहुत मज़ेदार पल।" },
  { language: "es", slug: "thumbs-up", canonicalId: "unicode:1F44D", localizedTitle: "Pulgar hacia arriba", localizedDescription: "Aprobación o acuerdo." },
  { language: "hi", slug: "thumbs-up", canonicalId: "unicode:1F44D", localizedTitle: "अंगूठा ऊपर", localizedDescription: "सहमति या मंज़ूरी।" },
  { language: "es", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "Confeti de fiesta", localizedDescription: "Celebración, cumpleaños y buenas noticias." },
  { language: "fr", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "Confettis", localizedDescription: "Fête, anniversaire et bonnes nouvelles." },
  { language: "hi", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "पार्टी पॉपर", localizedDescription: "जश्न, जन्मदिन और खुशखबरी।" },
  { language: "es", slug: "crying-face", canonicalId: "unicode:1F622", localizedTitle: "Cara llorando", localizedDescription: "Tristeza o empatía." },
  { language: "fr", slug: "crying-face", canonicalId: "unicode:1F622", localizedTitle: "Visage qui pleure", localizedDescription: "Tristesse ou empathie." },
  { language: "de", slug: "grinning-face", canonicalId: "unicode:1F600", localizedTitle: "Grinsendes Gesicht", localizedDescription: "Freude und Freundlichkeit." },
  { language: "pt", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "Fogo", localizedDescription: "Calor, hype ou algo em alta." },
  { language: "es", slug: "folded-hands", canonicalId: "unicode:1F64F", localizedTitle: "Manos en oración", localizedDescription: "Gracias, por favor, o apoyo." },
  { language: "fr", slug: "folded-hands", canonicalId: "unicode:1F64F", localizedTitle: "Mains en prière", localizedDescription: "Merci, s'il vous plaît, ou soutien." },
  { language: "hi", slug: "folded-hands", canonicalId: "unicode:1F64F", localizedTitle: "जोड़े हुए हाथ", localizedDescription: "धन्यवाद, विनती, या समर्थन।" },
  { language: "pt", slug: "grinning-face", canonicalId: "unicode:1F600", localizedTitle: "Rosto sorridente", localizedDescription: "Felicidade e simpatia." },
  { language: "de", slug: "skull", canonicalId: "unicode:1F480", localizedTitle: "Totenkopf", localizedDescription: "Humor negro oder Halloween-Stimmung." },
  { language: "es", slug: "smiling-face-with-heart-eyes", canonicalId: "unicode:1F60D", localizedTitle: "Cara sonriente con ojos de corazón", localizedDescription: "Admiración, cariño o enamoramiento." },
  { language: "es", slug: "hundred-points", canonicalId: "unicode:1F4AF", localizedTitle: "Cien puntos", localizedDescription: "Perfección, máximo esfuerzo o aprobación total." },
  { language: "fr", slug: "thumbs-up", canonicalId: "unicode:1F44D", localizedTitle: "Pouce vers le haut", localizedDescription: "Approbation ou accord." },
  { language: "de", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "Konfetti", localizedDescription: "Feier, Geburtstag und gute Nachrichten." },
  { language: "pt", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "Confete", localizedDescription: "Celebração, aniversário e boas notícias." },
  { language: "ja", slug: "fire", canonicalId: "unicode:1F525", localizedTitle: "炎", localizedDescription: "熱さ、ハイプ、またはトレンド。" },
  { language: "es", slug: "pleading-face", canonicalId: "unicode:1F97A", localizedTitle: "Cara suplicante", localizedDescription: "Por favor, disculpa o petición suave." },
  { language: "es", slug: "sparkles", canonicalId: "unicode:2728", localizedTitle: "Destellos", localizedDescription: "Magia, énfasis o algo especial." },
  { language: "fr", slug: "sparkles", canonicalId: "unicode:2728", localizedTitle: "Étincelles", localizedDescription: "Magie, emphase ou quelque chose de spécial." },
  { language: "fr", slug: "hundred-points", canonicalId: "unicode:1F4AF", localizedTitle: "Cent points", localizedDescription: "Score parfait ou approbation totale." },
  { language: "de", slug: "thumbs-up", canonicalId: "unicode:1F44D", localizedTitle: "Daumen hoch", localizedDescription: "Zustimmung oder Bestätigung." },
  { language: "de", slug: "crying-face", canonicalId: "unicode:1F622", localizedTitle: "Weinendes Gesicht", localizedDescription: "Traurigkeit oder Mitgefühl." },
  { language: "hi", slug: "sparkles", canonicalId: "unicode:2728", localizedTitle: "चमक", localizedDescription: "जादू, जोर या कुछ खास।" },
  { language: "hi", slug: "grinning-face", canonicalId: "unicode:1F600", localizedTitle: "मुस्कुराता चेहरा", localizedDescription: "खुशी और दोस्ताना स्वभाव।" },
  { language: "pt", slug: "thumbs-up", canonicalId: "unicode:1F44D", localizedTitle: "Polegar para cima", localizedDescription: "Aprovação ou concordância." },
  { language: "pt", slug: "folded-hands", canonicalId: "unicode:1F64F", localizedTitle: "Mãos juntas", localizedDescription: "Gratidão, por favor ou apoio." },
  { language: "ja", slug: "party-popper", canonicalId: "unicode:1F389", localizedTitle: "クラッカー", localizedDescription: "お祝い、誕生日、朗報。" },
  { language: "ja", slug: "face-with-tears-of-joy", canonicalId: "unicode:1F602", localizedTitle: "嬉し泣きの顔", localizedDescription: "大笑いやとても面白い瞬間。" },
];

export function listPublishedLocalizedPages(): readonly PublishedLocalizedPage[] {
  return PUBLISHED_LOCALIZED_PAGES;
}

export function getPublishedLocalizedPage(language: string, slug: string): PublishedLocalizedPage | null {
  return PUBLISHED_LOCALIZED_PAGES.find((p) => p.language === language && p.slug === slug) ?? null;
}

export function getLocalizedStaticParams(): { lang: string; slug: string }[] {
  return PUBLISHED_LOCALIZED_PAGES.map((p) => ({ lang: p.language, slug: p.slug }));
}

/** Hreflang alternates for all genuinely published translations of a slug. */
export function getPublishedHreflangLanguages(slug: string): readonly SupportedLanguage[] {
  const langs = new Set<SupportedLanguage>(["en"]);
  for (const page of PUBLISHED_LOCALIZED_PAGES) {
    if (page.slug === slug) langs.add(page.language);
  }
  return [...langs];
}
