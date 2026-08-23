import { readCloudflareVar } from "@/lib/cloudflare/runtime-env";
import { parseMasterR2Mode, shouldReadFromR2Binding } from "@/lib/master/r2/config";
import type { R2BucketBinding } from "./types";

type CloudflareEnv = { MASTER_R2?: R2BucketBinding };

export async function resolveMasterR2Binding(): Promise<R2BucketBinding | null> {
  const runtimeMode = parseMasterR2Mode(await readCloudflareVar("MASTER_R2_MODE"));
  if (runtimeMode !== "ENABLED" && !shouldReadFromR2Binding()) {
    return null;
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const bucket = (context.env as CloudflareEnv).MASTER_R2;
    return bucket ?? null;
  } catch {
    return null;
  }
}
