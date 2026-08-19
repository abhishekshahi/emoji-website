async function main() {
  const train = await fetch("https://huggingface.co/api/datasets/mrzjy/kaomoji_caption/tree/main/train").then((r) => r.json());
  console.log("hf train", JSON.stringify(train));

  const page = await fetch("https://japaneseemoticons.org/all-collections/").then((r) => r.text());
  console.log("all-collections len", page.length);
  const links = [...page.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.includes("collection") || h.includes("kaomoji"))
    .slice(0, 30);
  console.log("links", links);

  const repo6 = await fetch("https://api.github.com/repos/6/kaomoji-json/contents/").then((r) => r.json());
  console.log("6 repo files", Array.isArray(repo6) ? repo6.map((f) => f.name) : repo6.message);

  const npm = await fetch("https://registry.npmjs.org/kaomoji/latest").then((r) => r.json());
  console.log("npm tarball", npm.dist.tarball);

  const gk = await fetch("https://raw.githubusercontent.com/xav-ie/generate-kaomoji/main/kaomoji.json").then((r) => r.json());
  let count = 0;
  function walk(n) {
    if (typeof n === "string") count++;
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === "object") Object.values(n).forEach(walk);
  }
  walk(gk);
  console.log("generate strings", count, "array len", gk.kaomoji?.length);
}

main().catch(console.error);
