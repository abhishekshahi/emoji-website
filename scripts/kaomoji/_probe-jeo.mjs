async function main() {
  const h = await fetch("https://japaneseemoticons.org/collection-of-kaomoji-happy/").then((r) => r.text());
  const patterns = [
    /class="kaomoji[^"]*"[^>]*>([^<]+)</g,
    /data-kaomoji="([^"]+)"/g,
    /class="[^"]*emoticon[^"]*"[^>]*>([^<]+)</g,
    /<span[^>]*>([^<]{2,80})<\/span>/g,
  ];
  for (const re of patterns) {
    const m = [...h.matchAll(re)];
    console.log(re.source.slice(0, 40), m.length, m.slice(0, 3).map((x) => x[1]));
  }
  const copy = [...h.matchAll(/copyText\(['"]([^'"]+)['"]\)/g)];
  console.log("copyText", copy.length, copy.slice(0, 5).map((x) => x[1]));
  const json = h.match(/var\s+\w+\s*=\s*(\[[\s\S]*?\]);/);
  console.log("embedded json", json ? json[1].slice(0, 100) : "none");
}

main().catch(console.error);
