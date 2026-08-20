import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bucketExists, isR2AccountEnabled, R2_BUCKET_NAME } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Checking Cloudflare R2 account availability...");
  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) {
    console.error("R2 UPLOAD BLOCKED:", account.message);
    console.error("Enable R2 at: https://dash.cloudflare.com/ -> R2 Object Storage -> Enable R2");
    console.error("");
    console.error("After enabling R2, create bucket emojiquick-master and run:");
    console.error("  npx wrangler r2 bucket create emojiquick-master");
    console.error("  npm run r2:upload-full");
    console.error("  npm run r2:upload");
    console.error("(Type YES when prompted - do not pipe YES automatically.)");
    process.exitCode = 2;
    return;
  }

  console.log("R2 account: OK");
  const exists = bucketExists(rootDir, R2_BUCKET_NAME);
  console.log(`Bucket ${R2_BUCKET_NAME}: ${exists ? "FOUND" : "NOT FOUND"}`);
  if (!exists) {
    console.log("");
    console.log("Create bucket:");
    console.log(`  npx wrangler r2 bucket create ${R2_BUCKET_NAME}`);
    process.exitCode = 2;
  }
}

main();