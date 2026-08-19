const UA = "EmojiQuick-Phase3/1.0";

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  return { status: r.status, text: await r.text(), url: r.url };
}

function parseEmoticonsText(html) {
  return [...html.matchAll(/<span class="emoticon"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim());
}

function parseMessletters(html) {
  return [...html.matchAll(/<li id="(\d+)" title="([^"]*)"><pre>([^<]+)<\/pre>/g)].map((m) => ({
    id: m[1],
    title: m[2],
    text: m[3],
  }));
}

async function main() {
  const et = await fetchText("https://www.emoticonstext.com/");
  const etItems = parseEmoticonsText(et.text);
  console.log("emoticonstext homepage", etItems.length, "unique", new Set(etItems).size);

  const mlIndex = await fetchText("https://www.messletters.com/en/emoticons/");
  const mlLinks = [...new Set([...mlIndex.text.matchAll(/href="(\/en\/emoticons\/[^"#?]+)"/g)].map((m) => m[1]))];
  console.log("messletters emoticon subpages", mlLinks.length, mlLinks.slice(0, 15));

  let mlTotal = 0;
  const mlUnique = new Set();
  for (const link of mlLinks) {
    const page = await fetchText("https://www.messletters.com" + link);
    const items = parseMessletters(page.text);
    mlTotal += items.length;
    for (const i of items) mlUnique.add(i.text);
    console.log(" ", link, items.length);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("messletters total", mlTotal, "unique", mlUnique.size);

  // wikipedia kaomoji page sample
  const wikiUrl =
    "https://en.wikipedia.org/w/api.php?action=parse&page=Kaomoji&prop=wikitext&format=json&origin=*";
  const wk = await fetchText(wikiUrl);
  const wj = JSON.parse(wk.text);
  const wt = wj.parse?.wikitext?.["*"] ?? "";
  console.log("wiki kaomoji wikitext chars", wt.length);

  // fastemoji category sample
  const fe = await fetchText("https://www.fastemoji.com/category/funny");
  console.log("fastemoji category len", fe.text.length, "has unicode emoji", fe.text.includes("emoji"));
}

main().catch(console.error);
