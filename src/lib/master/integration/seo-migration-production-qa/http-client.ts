export interface HttpProbeResult {
  readonly url: string;
  readonly status: number;
  readonly location: string | null;
  readonly finalUrl: string;
  readonly bodySnippet: string | null;
}

export function normalizePathname(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return pathname;
  }
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function locationPathname(location: string | null, baseUrl: string): string | null {
  if (!location) {
    return null;
  }
  try {
    const resolved = new URL(location, baseUrl);
    return normalizePathname(resolved.pathname);
  } catch {
    return null;
  }
}

export function buildProbeHeaders(): Record<string, string> {
  return {
    Accept: "text/html",
  };
}

export async function probeUrl(
  baseUrl: string,
  path: string,
  options?: { followRedirects?: boolean },
): Promise<HttpProbeResult> {
  const url = new URL(path, baseUrl).toString();
  try {
    const response = await fetch(url, {
      redirect: options?.followRedirects === false ? "manual" : "follow",
      headers: buildProbeHeaders(),
    });

    let bodySnippet: string | null = null;
    if (response.status === 200) {
      const text = await response.text();
      bodySnippet = text.slice(0, 8000);
    }

    return Object.freeze({
      url,
      status: response.status,
      location: response.headers.get("location"),
      finalUrl: response.url,
      bodySnippet,
    });
  } catch {
    return Object.freeze({
      url,
      status: 0,
      location: null,
      finalUrl: url,
      bodySnippet: null,
    });
  }
}

export function extractCanonicalHref(html: string | null, baseUrl: string): string | null {
  if (!html) {
    return null;
  }
  const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
  if (!match) {
    return null;
  }
  const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
  if (!hrefMatch) {
    return null;
  }
  return new URL(hrefMatch[1], baseUrl).toString();
}

export function canonicalPathname(href: string | null): string | null {
  if (!href) {
    return null;
  }
  try {
    return normalizePathname(new URL(href).pathname);
  } catch {
    return null;
  }
}

export function canonicalPathsMatch(actualHref: string | null, expectedPath: string, baseUrl: string): boolean {
  const actualPath = canonicalPathname(actualHref);
  const expected = canonicalPathname(new URL(expectedPath, baseUrl).toString());
  return actualPath !== null && expected !== null && actualPath === expected;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
