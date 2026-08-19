import { extractStringsFromJson } from "../../src/lib/kaomoji/collection/importers/github-repo";

const gk = { kaomoji: [{ category: "joy", value: "(* ^ ω ^)" }, { category: "joy", value: "(´ ∀ ` *)" }] };
const entries = extractStringsFromJson(gk, { source_file: "kaomoji.json" }, { idPrefix: "gk" });
console.log("local entries", entries.length, entries);

async function remote() {
  const payload = await fetch("https://raw.githubusercontent.com/xav-ie/generate-kaomoji/main/kaomoji.json").then((r) => r.json());
  const remoteEntries = extractStringsFromJson(payload, { source_file: "kaomoji.json" }, { idPrefix: "gk" });
  console.log("remote entries", remoteEntries.length, remoteEntries[0]);
  console.log("first item", payload.kaomoji?.[0]);
}

remote().catch(console.error);
