import "server-only";
import { parseKaomojiCloudflareMode } from "./config";

export interface KaomojiD1PreparedStatement {
  bind(...values: unknown[]): KaomojiD1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

export interface KaomojiD1Database {
  prepare(query: string): KaomojiD1PreparedStatement;
}

type CloudflareEnv = {
  KAOMOJI_D1?: KaomojiD1Database;
  KAOMOJI_CLOUDFLARE_MODE?: string;
};

export async function resolveKaomojiD1Binding(): Promise<KaomojiD1Database | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let context;
    try {
      context = getCloudflareContext({ async: false });
    } catch {
      context = await getCloudflareContext({ async: true });
    }
    const env = context.env as CloudflareEnv;
    const mode = parseKaomojiCloudflareMode(env.KAOMOJI_CLOUDFLARE_MODE ?? process.env.KAOMOJI_CLOUDFLARE_MODE);
    if (mode !== "STAGING" && mode !== "PRODUCTION") return null;
    return env.KAOMOJI_D1 ?? null;
  } catch {
    return null;
  }
}
