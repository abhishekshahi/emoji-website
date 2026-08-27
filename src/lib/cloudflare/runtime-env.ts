/** Read Cloudflare / process env vars at runtime (Worker or Node). */
export async function readCloudflareVar(name: string): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let context;
    try {
      context = getCloudflareContext({ async: false });
    } catch {
      context = await getCloudflareContext({ async: true });
    }
    const env = context.env as Record<string, string | undefined>;
    if (env[name] !== undefined) return env[name];
  } catch {
    // fall through to process.env
  }
  return process.env[name];
}
