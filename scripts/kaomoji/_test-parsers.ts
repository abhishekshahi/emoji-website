import { extractStringsFromJson, parseKawaiiFacesJs } from "../../src/lib/kaomoji/collection/importers/github-repo";

async function main() {
  const gk = await fetch("https://raw.githubusercontent.com/xav-ie/generate-kaomoji/main/kaomoji.json").then((r) => r.json());
  const e = extractStringsFromJson(gk, { source_file: "kaomoji.json" }, { idPrefix: "gk" });
  console.log("generate entries", e.length, e[0]);

  const kf = await fetch("https://raw.githubusercontent.com/matthewsimo/kawaii-faces/master/src/data/happy.js").then((r) => r.text());
  console.log("kawaii old parser", parseKawaiiFacesJs(kf, "happy", "happy.js").length);

  const info = await fetch("https://huggingface.co/datasets/mrzjy/kaomoji_caption/raw/main/train/dataset_info.json").then((r) => r.json());
  console.log("hf splits", info.splits);

  const kao = await fetch("https://raw.githubusercontent.com/6/kaomoji-json/master/kao-utf8.json").then((r) => r.json());
  console.log("kao-utf8 type", typeof kao, Array.isArray(kao) ? kao.length : Object.keys(kao).slice(0, 5));
}

main().catch(console.error);
