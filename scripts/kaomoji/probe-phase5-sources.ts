import { fetchEmoticonWooormEntries, fetchNodeKaomojiEntries, fetchKaomojiCaptionEntries, fetchKawaiiFacesEntries, fetchRandomKaomojiEntries, fetchGenerateKaomojiEntries } from "@/lib/kaomoji/collection/importers/phase5-sources";

async function main() {
  for (const [name, fn] of [
    ["wooorm", fetchEmoticonWooormEntries],
    ["node", fetchNodeKaomojiEntries],
    ["hf", fetchKaomojiCaptionEntries],
    ["kawaii", fetchKawaiiFacesEntries],
    ["random", fetchRandomKaomojiEntries],
    ["generate", fetchGenerateKaomojiEntries],
  ] as const) {
    const r = await fn();
    console.log(name, r.entries.length, r.errors);
  }
}

main();
