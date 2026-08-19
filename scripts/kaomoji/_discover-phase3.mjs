const UA = "EmojiQuick-Phase3-Discovery/1.0 (research; local dev)";

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
    redirect: "follow",
  });
  return { status: r.status, url: r.url, text: await r.text() };
}

function countFaces(text) {
  const ascii = text.match(/[:;=8][\-~^]?[)(DPpOo3\\\/\][|][^\s<]{0,20}/g) || [];
  const kaomoji = text.match(/[（(][^\s<]{1,50}[）)]/g) || [];
  return { ascii: ascii.length, kaomoji: kaomoji.length, asciiSample: ascii.slice(0, 5), kaomojiSample: kaomoji.slice(0, 5) };
}

async function main() {
  const targets = [
    ["messletters", "https://www.messletters.com/en/emoticons/"],
    ["emoticonstext", "https://emoticonstext.com/"],
    ["toolcalculator", "https://www.toolcalculator.com/"],
    ["fastemoji-sample", "https://www.fastemoji.com/collections/"],
    ["kaomojis-home", "https://kaomojis.org/"],
  ];

  for (const [name, url] of targets) {
    try {
      const { status, url: finalUrl, text } = await fetchText(url);
      const faces = countFaces(text);
      const title = text.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
      const links = [...text.matchAll(/href="(\/[^"#?]+)"/g)].map((m) => m[1]);
      const uniqueLinks = [...new Set(links)].slice(0, 20);
      console.log(JSON.stringify({ name, status, finalUrl, title, len: text.length, faces, linkSample: uniqueLinks }, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ name, error: e.message }));
    }
  }

  // fastemoji main sitemap count
  const sm = await fetchText("https://www.fastemoji.com/sitemaps/main/sitemap_0.xml");
  const urlCount = (sm.text.match(/<loc>/g) || []).length;
  console.log(JSON.stringify({ fastemoji_main_sitemap_0_urls: urlCount }));
}

main();
